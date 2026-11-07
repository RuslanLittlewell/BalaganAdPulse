import { can, type Action } from '@adpulse/access-policy';
import { AppError } from '#shared/domain/index.js';
import type { ActorContext, IdGenerator, TransactionContext, UnitOfWork } from '#shared/application/index.js';
import type { AuditWriter } from '#modules/audit/index.js';
import type { CompanyFields, CompanyRecord, PersonFields, PersonRecord } from '../domain/crm-record.js';
import type { CrmRecordRepository, LeadEvent } from './ports.js';

export interface CrmRecordDependencies {
  records: CrmRecordRepository;
  audit: AuditWriter;
  ids: IdGenerator;
  unitOfWork: UnitOfWork;
  publish: (event: LeadEvent) => void;
}

type Kind = 'crm-company' | 'crm-person';

export function createCrmRecordUseCases(d: CrmRecordDependencies) {
  async function authorize(actor: ActorContext, clientId: string, action: Action) {
    if (!await d.records.reachesClient(actor, clientId)) throw new AppError('not-found', 'Client not found');
    if (!can(actor, action, 'lead')) throw new AppError('forbidden', 'Action not permitted');
  }

  async function announce(actor: ActorContext, clientId: string) {
    for (const board of await d.records.projectsOf(clientId)) d.publish({ kind: 'crm.changed', orgId: actor.orgId, board });
  }

  async function mutation<T>(actor: ActorContext, clientId: string, action: Action, work: (context: TransactionContext) => Promise<T>) {
    await authorize(actor, clientId, action);
    const result = await d.unitOfWork.run(async (context) => {
      await d.records.lock(context, actor.orgId, clientId);
      return work(context);
    });
    await announce(actor, clientId);
    return result;
  }

  async function audit(context: TransactionContext, actor: ActorContext, kind: Kind, record: { id: string; clientId: string }, action: 'CREATE' | 'UPDATE' | 'DELETE', changes: unknown) {
    await d.audit.append(context, {
      action, entityType: kind, entityId: record.id, clientId: record.clientId, projectId: null,
      summary: `${action} ${kind === 'crm-company' ? 'company' : 'person'}`,
      changes: JSON.parse(JSON.stringify(changes)),
    }, actor);
  }

  async function companyOf(actor: ActorContext, clientId: string, id: string, context?: TransactionContext) {
    const company = await d.records.company(actor, clientId, id, context);
    if (!company) throw new AppError('not-found', 'Organization not found');
    return company;
  }

  async function personOf(actor: ActorContext, clientId: string, id: string, context?: TransactionContext) {
    const person = await d.records.person(actor, clientId, id, context);
    if (!person) throw new AppError('not-found', 'Person not found');
    return person;
  }

  async function checkCompany(context: TransactionContext, actor: ActorContext, clientId: string, companyId: string | null | undefined) {
    if (companyId && !await d.records.companyInClient(actor.orgId, clientId, companyId, context)) {
      throw new AppError('validation', 'That organization belongs to another client');
    }
  }

  return {
    async companies(actor: ActorContext, clientId: string): Promise<CompanyRecord[]> {
      await authorize(actor, clientId, 'read');
      return d.records.companies(actor, clientId);
    },
    async people(actor: ActorContext, clientId: string): Promise<PersonRecord[]> {
      await authorize(actor, clientId, 'read');
      return d.records.people(actor, clientId);
    },
    async company(actor: ActorContext, clientId: string, id: string) {
      await authorize(actor, clientId, 'read');
      const company = await companyOf(actor, clientId, id);
      const [people, leads] = await Promise.all([d.records.companyPeople(actor, id), d.records.relatedLeads(actor, { companyId: id })]);
      return { ...company, people, leads };
    },
    async person(actor: ActorContext, clientId: string, id: string) {
      await authorize(actor, clientId, 'read');
      const person = await personOf(actor, clientId, id);
      return { ...person, leads: await d.records.relatedLeads(actor, { personId: id }) };
    },
    createCompany(actor: ActorContext, clientId: string, input: CompanyFields) {
      return mutation(actor, clientId, 'create', async (context) => {
        const company = await d.records.createCompany(context, actor, { ...input, id: d.ids.generate(), orgId: actor.orgId, clientId });
        await audit(context, actor, 'crm-company', company, 'CREATE', { after: company });
        return company;
      });
    },
    createPerson(actor: ActorContext, clientId: string, input: PersonFields) {
      return mutation(actor, clientId, 'create', async (context) => {
        await checkCompany(context, actor, clientId, input.companyId);
        const person = await d.records.createPerson(context, actor, { ...input, id: d.ids.generate(), orgId: actor.orgId, clientId });
        await audit(context, actor, 'crm-person', person, 'CREATE', { after: person });
        return person;
      });
    },
    updateCompany(actor: ActorContext, clientId: string, id: string, input: Partial<CompanyFields>) {
      return mutation(actor, clientId, 'update', async (context) => {
        const before = await companyOf(actor, clientId, id, context);
        const after = await d.records.updateCompany(context, actor, id, input);
        await audit(context, actor, 'crm-company', after, 'UPDATE', { before, after });
        return after;
      });
    },
    updatePerson(actor: ActorContext, clientId: string, id: string, input: Partial<PersonFields>) {
      return mutation(actor, clientId, 'update', async (context) => {
        const before = await personOf(actor, clientId, id, context);
        await checkCompany(context, actor, clientId, input.companyId);
        const after = await d.records.updatePerson(context, actor, id, input);
        await audit(context, actor, 'crm-person', after, 'UPDATE', { before, after });
        return after;
      });
    },
    deleteCompany(actor: ActorContext, clientId: string, id: string) {
      return mutation(actor, clientId, 'delete', async (context) => {
        const before = await companyOf(actor, clientId, id, context);
        await d.records.deleteCompany(context, id);
        await audit(context, actor, 'crm-company', before, 'DELETE', { before });
      });
    },
    deletePerson(actor: ActorContext, clientId: string, id: string) {
      return mutation(actor, clientId, 'delete', async (context) => {
        const before = await personOf(actor, clientId, id, context);
        await d.records.deletePerson(context, id);
        await audit(context, actor, 'crm-person', before, 'DELETE', { before });
      });
    },
  };
}

export type CrmRecordUseCases = ReturnType<typeof createCrmRecordUseCases>;
