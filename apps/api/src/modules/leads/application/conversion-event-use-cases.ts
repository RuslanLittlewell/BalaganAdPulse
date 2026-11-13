import { can, type Action } from '@adpulse/access-policy';
import { AppError } from '#shared/domain/index.js';
import type { ActorContext, IdGenerator, TransactionContext, UnitOfWork } from '#shared/application/index.js';
import type { AuditWriter } from '#modules/audit/index.js';
import { CONVERSION_EVENT_LIMIT, nameKeyOf, type ConversionEventFields, type ConversionEventRecord } from '../domain/conversion-event.js';
import { isLeadStage } from '../domain/lead.js';
import type { ConversionEventRepository, LeadRepository } from './ports.js';

export interface ConversionEventUseCaseDependencies {
  leads: Pick<LeadRepository, 'reaches' | 'lock' | 'columns' | 'clientOf'>;
  events: ConversionEventRepository;
  audit: AuditWriter;
  ids: IdGenerator;
  unitOfWork: UnitOfWork;
}

export function createConversionEventUseCases(d: ConversionEventUseCaseDependencies) {
  async function authorize(actor: ActorContext, board: string, action: Action) {
    if (!await d.leads.reaches(actor, board)) throw new AppError('not-found', 'Board not found');
    if (!can(actor, action, 'integration')) throw new AppError('forbidden', 'Action not permitted');
  }

  async function change<T>(actor: ActorContext, board: string, action: Action, work: (context: TransactionContext, events: ConversionEventRecord[]) => Promise<T>) {
    await authorize(actor, board, action);
    return d.unitOfWork.run(async (context) => {
      await d.leads.lock(context, actor, board);
      return work(context, await d.events.list(board, context));
    });
  }

  async function boardStages(context: TransactionContext, actor: ActorContext, board: string, stages: readonly string[]) {
    const unique = [...new Set(stages)];
    if (unique.length === 0) throw new AppError('validation', 'An event needs at least one stage');
    const columns = new Set((await d.leads.columns(actor, board, context)).map((column) => column.id));
    if (unique.some((stage) => !isLeadStage(stage) && !columns.has(stage))) throw new AppError('validation', 'That stage is not a column of this board');
    return unique;
  }

  function assertNameFree(events: readonly ConversionEventRecord[], name: string, except?: string) {
    const key = nameKeyOf(name);
    if (events.some((event) => event.id !== except && nameKeyOf(event.name) === key)) throw new AppError('conflict', 'An event with that name already exists in this project');
  }

  function find(events: readonly ConversionEventRecord[], id: string) {
    const event = events.find((candidate) => candidate.id === id);
    if (!event) throw new AppError('not-found', 'Event not found');
    return event;
  }

  async function audit(context: TransactionContext, actor: ActorContext, board: string, event: ConversionEventRecord, action: 'CREATE' | 'UPDATE' | 'DELETE', changes: unknown) {
    await d.audit.append(context, {
      action, entityType: 'crm-conversion-event', entityId: event.id, clientId: await d.leads.clientOf(board), projectId: board,
      summary: `${action} conversion event`, changes: JSON.parse(JSON.stringify(changes)),
    }, actor);
  }

  return {
    async list(actor: ActorContext, board: string) {
      await authorize(actor, board, 'read');
      return d.events.list(board);
    },
    create(actor: ActorContext, board: string, input: ConversionEventFields) {
      return change(actor, board, 'create', async (context, events) => {
        if (events.length >= CONVERSION_EVENT_LIMIT) throw new AppError('validation', `A project holds at most ${CONVERSION_EVENT_LIMIT} events`);
        assertNameFree(events, input.name);
        const stages = await boardStages(context, actor, board, input.stages);
        const event = await d.events.create(context, { ...input, stages, id: d.ids.generate(), orgId: actor.orgId, projectId: board });
        await audit(context, actor, board, event, 'CREATE', { after: event });
        return event;
      });
    },
    update(actor: ActorContext, board: string, id: string, input: Partial<ConversionEventFields>) {
      return change(actor, board, 'update', async (context, events) => {
        const before = find(events, id);
        if (input.name !== undefined) assertNameFree(events, input.name, id);
        const stages = input.stages === undefined ? before.stages : await boardStages(context, actor, board, input.stages);
        const event = await d.events.update(context, id, {
          name: input.name ?? before.name,
          stages,
          carriesAmount: input.carriesAmount ?? before.carriesAmount,
        });
        await audit(context, actor, board, event, 'UPDATE', { before, after: event });
        return event;
      });
    },
    remove(actor: ActorContext, board: string, id: string) {
      return change(actor, board, 'delete', async (context, events) => {
        const event = find(events, id);
        await d.events.delete(context, id);
        await audit(context, actor, board, event, 'DELETE', { before: event });
      });
    },
  };
}

export type ConversionEventUseCases = ReturnType<typeof createConversionEventUseCases>;
