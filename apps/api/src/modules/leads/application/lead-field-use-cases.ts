import { AppError } from '#shared/domain/index.js';
import type { ActorContext, IdGenerator, TransactionContext } from '#shared/application/index.js';
import type { AuditWriter } from '#modules/audit/index.js';
import type { LeadRecord } from '../domain/lead.js';
import {
  assertFieldName,
  FIELD_LIMIT,
  fieldViewOf,
  isListType,
  settleOptions,
  withoutOptions,
  type LeadFieldRecord,
  type LeadFieldType,
  type RequestedOption,
} from '../domain/lead-field.js';
import { createBoardMutation, type BoardMutationDependencies } from './board-mutation.js';
import type { LeadFieldRepository, LeadRepository } from './ports.js';

export interface LeadFieldDependencies extends BoardMutationDependencies {
  leads: Pick<LeadRepository, 'reaches' | 'lock' | 'list' | 'update'>;
  fields: LeadFieldRepository;
  audit: AuditWriter;
  ids: IdGenerator;
}

export interface NewLeadField { name: string; type: LeadFieldType; options?: RequestedOption[] }
export interface LeadFieldChange { name?: string; options?: RequestedOption[]; position?: number }

export function createLeadFieldUseCases(d: LeadFieldDependencies) {
  const { authorize, mutation } = createBoardMutation(d, ['fields', 'leads', 'activity']);

  function find(fields: readonly LeadFieldRecord[], id: string) {
    const field = fields.find(candidate => candidate.id === id);
    if (!field) throw new AppError('not-found', 'Field not found');
    return field;
  }

  async function reorder(context: TransactionContext, fields: readonly LeadFieldRecord[]) {
    for (const [position, field] of fields.entries()) {
      if (field.position !== position) await d.fields.update(context, field.id, { position });
    }
  }

  async function clear(context: TransactionContext, rows: readonly LeadRecord[], fieldId: string, removed?: ReadonlySet<string>) {
    const cleared: string[] = [];
    for (const lead of rows) {
      const next = removed ? withoutOptions(lead.customValues, fieldId, removed) : withoutField(lead, fieldId);
      if (next === null) continue;
      await d.leads.update(context, lead.id, { customValues: next });
      cleared.push(lead.id);
    }
    return cleared;
  }

  function withoutField(lead: LeadRecord, fieldId: string) {
    if (lead.customValues[fieldId] === undefined) return null;
    const { [fieldId]: _removed, ...rest } = lead.customValues;
    return rest;
  }

  async function audit(context: TransactionContext, actor: ActorContext, field: LeadFieldRecord, action: 'CREATE' | 'UPDATE' | 'DELETE', changes: unknown) {
    await d.audit.append(context, {
      action,
      entityType: 'lead-field',
      entityId: field.id,
      clientId: field.clientId,
      projectId: field.projectId,
      summary: `${action} lead field`,
      changes: JSON.parse(JSON.stringify(changes)),
    }, actor);
  }

  return {
    async list(actor: ActorContext, board: string) {
      await authorize(actor, board, 'read');
      return (await d.fields.list(actor.orgId, board)).map(fieldViewOf);
    },

    create(actor: ActorContext, board: string, input: NewLeadField) {
      return mutation(actor, board, 'create', async context => {
        const fields = await d.fields.list(actor.orgId, board, context);
        if (fields.length >= FIELD_LIMIT) throw new AppError('validation', `A board holds at most ${FIELD_LIMIT} fields`);
        assertFieldName(fields, input.name);
        const requested = input.options ?? (isListType(input.type) ? [] : undefined);
        const { options } = settleOptions(input.type, [], requested, () => d.ids.generate());
        const field = await d.fields.create(context, {
          id: d.ids.generate(), orgId: actor.orgId, projectId: board,
          name: input.name, type: input.type, options, position: fields.length,
        });
        await audit(context, actor, field, 'CREATE', { after: field });
        return fieldViewOf(field);
      });
    },

    update(actor: ActorContext, board: string, id: string, input: LeadFieldChange) {
      return mutation(actor, board, 'update', async (context, rows) => {
        const fields = await d.fields.list(actor.orgId, board, context);
        const before = find(fields, id);
        if (input.name !== undefined) assertFieldName(fields, input.name, id);
        const { options, removed } = settleOptions(before.type, before.options, input.options, () => d.ids.generate());
        if (input.name !== undefined || input.options !== undefined) {
          await d.fields.update(context, id, {
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.options === undefined ? {} : { options }),
          });
        }
        const clearedLeadIds = removed.length > 0 ? await clear(context, rows, id, new Set(removed)) : [];
        if (input.position !== undefined) {
          const rest = fields.filter(field => field.id !== id);
          const at = Math.min(input.position, rest.length);
          await reorder(context, [...rest.slice(0, at), before, ...rest.slice(at)]);
        }
        const result = await d.fields.list(actor.orgId, board, context);
        await audit(context, actor, before, 'UPDATE', { before, after: find(result, id), clearedLeadIds });
        return result.map(fieldViewOf);
      });
    },

    delete(actor: ActorContext, board: string, id: string) {
      return mutation(actor, board, 'delete', async (context, rows) => {
        const fields = await d.fields.list(actor.orgId, board, context);
        const field = find(fields, id);
        const clearedLeadIds = await clear(context, rows, id);
        await d.fields.delete(context, id);
        await reorder(context, fields.filter(candidate => candidate.id !== id));
        await audit(context, actor, field, 'DELETE', { before: field, clearedLeadIds });
      });
    },
  };
}

export type LeadFieldUseCases = ReturnType<typeof createLeadFieldUseCases>;
