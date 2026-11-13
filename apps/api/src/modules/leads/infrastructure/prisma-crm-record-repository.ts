import type { Prisma, PrismaClient } from '@prisma/client';
import type { ActorContext, TransactionContext } from '#shared/application/index.js';
import type { PrismaUnitOfWork } from '#shared/infrastructure/prisma-unit-of-work.js';
import { visibleLeads, visibleRecords } from '#shared/infrastructure/partner-reach.js';
import { reachableProjects } from '#shared/infrastructure/project-reach.js';
import type { CrmRecordRepository } from '../application/ports.js';
import { FIXED_STAGE_COLORS, LEAD_STAGE_NAMES } from '../domain/lead.js';
import { type CompanyFields, type CompanyRecord, type PersonFields, type PersonRecord, type RelatedLead } from '../domain/crm-record.js';

const reachableLeads = (actor: ActorContext): Prisma.LeadWhereInput => visibleLeads(actor);

const companySelect = (actor: ActorContext) => ({
  id: true, orgId: true, clientId: true, name: true, website: true, phone: true, notes: true, createdAt: true, updatedAt: true,
  _count: { select: { people: { where: visibleRecords(actor) }, leads: { where: reachableLeads(actor) } } },
}) satisfies Prisma.CompanySelect;

const personSelect = (actor: ActorContext) => ({
  id: true, orgId: true, clientId: true, name: true, phone: true, email: true, telegram: true, messenger: true,
  companyId: true, notes: true, createdAt: true, updatedAt: true,
  company: { select: { id: true, name: true, leads: { where: visibleLeads(actor), select: { id: true }, take: 1 } } },
  _count: { select: { leads: { where: reachableLeads(actor) } } },
}) satisfies Prisma.PersonSelect;

type CompanyRow = Prisma.CompanyGetPayload<{ select: ReturnType<typeof companySelect> }>;
type PersonRow = Prisma.PersonGetPayload<{ select: ReturnType<typeof personSelect> }>;

const toCompany = ({ _count, ...row }: CompanyRow): CompanyRecord => ({ ...row, peopleCount: _count.people, leadCount: _count.leads });
const toPerson = ({ _count, company, ...row }: PersonRow, partner = false): PersonRecord => ({ ...row, companyId: partner && !company?.leads.length ? null : row.companyId, company: company && (!partner || company.leads.length > 0) ? {id:company.id,name:company.name} : null, leadCount: _count.leads });

const empty = (value: string | null | undefined) => (value === undefined ? undefined : value === null || value.trim() === '' ? null : value.trim());

function personData(input: Partial<PersonFields>) {
  const data: Prisma.PersonUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.phone !== undefined) data.phone = empty(input.phone);
  if (input.email !== undefined) data.email = empty(input.email);
  if (input.telegram !== undefined) data.telegram = empty(input.telegram);
  if (input.messenger !== undefined) data.messenger = empty(input.messenger);
  if (input.companyId !== undefined) data.companyId = input.companyId;
  if (input.notes !== undefined) data.notes = empty(input.notes);
  return data;
}

function companyData(input: Partial<CompanyFields>) {
  const data: Prisma.CompanyUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.website !== undefined) data.website = empty(input.website);
  if (input.phone !== undefined) data.phone = empty(input.phone);
  if (input.notes !== undefined) data.notes = empty(input.notes);
  return data;
}

export class PrismaCrmRecordRepository implements CrmRecordRepository {
  constructor(private readonly prisma: PrismaClient, private readonly uow: PrismaUnitOfWork<Prisma.TransactionClient>) {}

  private client(context?: TransactionContext) {
    return context ? this.uow.clientFor<Prisma.TransactionClient>(context) : this.prisma;
  }

  async reachesClient(actor: ActorContext, clientId: string) {
    return (await this.prisma.project.count({ where: { AND: [{ clientId }, reachableProjects(actor)] } })) > 0;
  }

  async projectsOf(clientId: string) {
    return (await this.prisma.project.findMany({ where: { clientId }, select: { id: true } })).map((project) => project.id);
  }

  async lock(context: TransactionContext, orgId: string, clientId: string) {
    await this.client(context).$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${orgId + ':client:' + clientId}, 0))`;
  }

  async companies(actor: ActorContext, clientId: string) {
    const rows = await this.prisma.company.findMany({ where: { orgId: actor.orgId, clientId, ...visibleRecords(actor) }, select: companySelect(actor), orderBy: [{ name: 'asc' }, { id: 'asc' }] });
    return rows.map(toCompany);
  }

  async people(actor: ActorContext, clientId: string) {
    const rows = await this.prisma.person.findMany({ where: { orgId: actor.orgId, clientId, ...visibleRecords(actor) }, select: personSelect(actor), orderBy: [{ name: 'asc' }, { id: 'asc' }] });
    return rows.map(row => toPerson(row, actor.role === 'PARTNER'));
  }

  async company(actor: ActorContext, clientId: string, id: string, context?: TransactionContext) {
    const row = await this.client(context).company.findFirst({ where: { id, orgId: actor.orgId, clientId, ...visibleRecords(actor) }, select: companySelect(actor) });
    return row && toCompany(row);
  }

  async person(actor: ActorContext, clientId: string, id: string, context?: TransactionContext) {
    const row = await this.client(context).person.findFirst({ where: { id, orgId: actor.orgId, clientId, ...visibleRecords(actor) }, select: personSelect(actor) });
    return row && toPerson(row, actor.role === 'PARTNER');
  }

  async createCompany(context: TransactionContext, actor: ActorContext, input: { id: string; orgId: string; clientId: string } & CompanyFields) {
    const { id, orgId, clientId, ...fields } = input;
    const row = await this.client(context).company.create({ data: { id, orgId, clientId, name: fields.name.trim(), ...companyData(fields) } as Prisma.CompanyUncheckedCreateInput, select: companySelect(actor) });
    return toCompany(row);
  }

  async createPerson(context: TransactionContext, actor: ActorContext, input: { id: string; orgId: string; clientId: string } & PersonFields) {
    const { id, orgId, clientId, ...fields } = input;
    const row = await this.client(context).person.create({ data: { id, orgId, clientId, name: fields.name.trim(), ...personData(fields) } as Prisma.PersonUncheckedCreateInput, select: personSelect(actor) });
    return toPerson(row, actor.role === 'PARTNER');
  }

  async updateCompany(context: TransactionContext, actor: ActorContext, id: string, input: Partial<CompanyFields>) {
    return toCompany(await this.client(context).company.update({ where: { id }, data: companyData(input), select: companySelect(actor) }));
  }

  async updatePerson(context: TransactionContext, actor: ActorContext, id: string, input: Partial<PersonFields>) {
    const row = await this.client(context).person.update({ where: { id }, data: personData(input), select: personSelect(actor) });
    return toPerson(row, actor.role === 'PARTNER');
  }

  async deleteCompany(context: TransactionContext, id: string) {
    await this.client(context).company.delete({ where: { id } });
  }

  async deletePerson(context: TransactionContext, id: string) {
    await this.client(context).person.delete({ where: { id } });
  }

  async companyInClient(orgId: string, clientId: string, id: string, context?: TransactionContext) {
    return (await this.client(context).company.count({ where: { id, orgId, clientId } })) > 0;
  }

  async personInClient(orgId: string, clientId: string, id: string, context?: TransactionContext) {
    return (await this.client(context).person.count({ where: { id, orgId, clientId } })) > 0;
  }

  async relatedLeads(actor: ActorContext, link: { personId: string } | { companyId: string }): Promise<RelatedLead[]> {
    const rows = await this.prisma.lead.findMany({
      where: { orgId: actor.orgId, ...link, ...reachableLeads(actor) },
      select: { id: true, name: true, stage: true, project: { select: { id: true, name: true } }, column: { select: { id: true, name: true, color: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      board: { key: row.project.id, label: row.project.name },
      stage: row.stage
        ? { id: row.stage, name: LEAD_STAGE_NAMES[row.stage], color: FIXED_STAGE_COLORS[row.stage] }
        : { id: row.column?.id ?? '', name: row.column?.name ?? '', color: row.column?.color ?? 'gray' },
    }));
  }

  async companyPeople(actor: ActorContext, companyId: string) {
    const rows = await this.prisma.person.findMany({ where: { orgId: actor.orgId, companyId, ...visibleRecords(actor) }, select: personSelect(actor), orderBy: [{ name: 'asc' }, { id: 'asc' }] });
    return rows.map(row => toPerson(row, actor.role === 'PARTNER'));
  }
}
