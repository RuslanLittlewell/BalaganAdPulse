import type { Prisma, PrismaClient } from '@prisma/client';
import type { ActorContext, TransactionContext } from '#shared/application/index.js';
import type { PrismaUnitOfWork } from '#shared/infrastructure/prisma-unit-of-work.js';
import type { LeadRepository } from '../application/ports.js';
import { LEAD_STAGES, placementOf, type ArrivalWindow, type LeadAnswer, type LeadColumnRecord, type LeadRecord, type LeadStage, type ProjectStageCounts } from '../domain/lead.js';

export const leadInclude = {
  ad:{select:{id:true,name:true,externalId:true}},
  project:{select:{id:true,clientId:true,name:true}},
  assignee:{select:{id:true,user:{select:{name:true,image:true}}}},
  metaSource:true,
} satisfies Prisma.LeadInclude;
type LeadRow = Prisma.LeadGetPayload<{include:typeof leadInclude}>;
const columnInclude = {project:{select:{clientId:true}}} satisfies Prisma.LeadColumnInclude;
type ColumnRow = Prisma.LeadColumnGetPayload<{include:typeof columnInclude}>;
const toColumnRecord = ({project, ...column}: ColumnRow): LeadColumnRecord => ({...column, clientId:project.clientId});

export function reachableProjects(actor: ActorContext): Prisma.ProjectWhereInput {
  if (actor.role === 'ADMIN') return {client:{orgId:actor.orgId}};
  return {
    client:{orgId:actor.orgId},
    OR:[
      {client:{access:{some:{membershipId:actor.membershipId, projectId:null}}}},
      {access:{some:{membershipId:actor.membershipId}}},
    ],
  };
}

export function toLeadRecord({metaSource, columnId, assignee, amount, ...lead}: LeadRow): LeadRecord {
  return {...lead, amount:amount === null ? null : amount.toFixed(4), assignee:assignee&&{id:assignee.id,name:assignee.user.name,image:assignee.user.image}, stage: lead.stage ?? columnId ?? 'NEW', metaSource: metaSource && {
    accountId:metaSource.accountId, formId:metaSource.formId,
    campaign:{externalId:metaSource.campaignExternalId, name:metaSource.campaignName},
    adSet:{externalId:metaSource.adSetExternalId, name:metaSource.adSetName},
    ad:{externalId:metaSource.adExternalId, name:metaSource.adName},
    submittedAt:metaSource.submittedAt, answers:metaSource.answers as unknown as LeadAnswer[], answersOmitted:metaSource.answersOmitted,
  }};
}

export class PrismaLeadRepository implements LeadRepository {
  constructor(private readonly prisma: PrismaClient, private readonly uow: PrismaUnitOfWork<Prisma.TransactionClient>) {}
  async boards(actor: ActorContext) {
    const projects = await this.prisma.project.findMany({
      where:reachableProjects(actor),
      select:{id:true, name:true, client:{select:{name:true}}},
      orderBy:[{client:{name:'asc'}}, {clientId:'asc'}, {position:'asc'}, {id:'asc'}],
    });
    return projects.map(project => ({key:project.id, label:project.name, clientName:project.client.name}));
  }
  async reaches(actor: ActorContext, board: string) {
    return (await this.prisma.project.count({where:{AND:[{id:board}, reachableProjects(actor)]}})) > 0;
  }
  async campaignInProject(campaignId: string, projectId: string) {
    return (await this.prisma.campaign.count({where:{id:campaignId, projectId}})) > 0;
  }
  async assigneeReachesBoard(orgId: string, membershipId: string, board: string) {
    const access = {OR:[{projectId:board},{projectId:null, client:{projects:{some:{id:board}}}}]};
    return (await this.prisma.membership.count({where:{id:membershipId,orgId,status:'ACTIVE',access:{some:access}}})) > 0;
  }
  async list(actor: ActorContext, board: string, context?: TransactionContext) {
    const rows = await (context ? this.uow.clientFor<Prisma.TransactionClient>(context) : this.prisma).lead.findMany({where:{orgId:actor.orgId, projectId:board},include:leadInclude,orderBy:[{stage:{sort:'asc',nulls:'last'}},{column:{position:'asc'}},{position:'asc'},{id:'asc'}]});
    return rows.map(toLeadRecord);
  }
  async lock(context: TransactionContext, actor: ActorContext, board: string) {
    await this.uow.clientFor<Prisma.TransactionClient>(context).$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actor.orgId + ':' + board}, 0))`;
  }
  async create(context: TransactionContext, {stage, ...input}: Parameters<LeadRepository['create']>[1]) {
    return toLeadRecord(await this.uow.clientFor<Prisma.TransactionClient>(context).lead.create({data:{...input,...placementOf(stage)},include:leadInclude}));
  }
  async update(context: TransactionContext, id: string, {stage, ...input}: Parameters<LeadRepository['update']>[2]) {
    return toLeadRecord(await this.uow.clientFor<Prisma.TransactionClient>(context).lead.update({where:{id},data:{...input,...(stage === undefined ? {} : placementOf(stage))},include:leadInclude}));
  }
  async delete(context: TransactionContext, id: string) {
    const tx = this.uow.clientFor<Prisma.TransactionClient>(context);
    const files = await tx.leadFile.findMany({where:{leadId:id}, select:{storageKey:true}});
    await tx.lead.delete({where:{id}});
    return files.map(file => file.storageKey);
  }
  async history(orgId: string, leadId: string) {
    const [events, source] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where:{orgId, entityType:'lead', entityId:leadId},
        select:{id:true, action:true, actorName:true, createdAt:true, changes:true},
        orderBy:[{createdAt:'asc'}, {id:'asc'}],
      }),
      this.prisma.leadMetaSource.findUnique({where:{leadId}, select:{submittedAt:true}}),
    ]);
    return {events, importedAt:source?.submittedAt ?? null};
  }
  async campaignNames(ids: readonly string[]) {
    if (ids.length === 0) return new Map<string, string>();
    const campaigns = await this.prisma.campaign.findMany({where:{id:{in:[...ids]}}, select:{id:true, name:true}});
    return new Map(campaigns.map(campaign => [campaign.id, campaign.name]));
  }
  async leadOnBoard(orgId: string, board: string, id: string) {
    const lead = await this.prisma.lead.findFirst({where:{id, orgId, projectId:board}, select:{id:true, projectId:true, project:{select:{clientId:true}}}});
    return lead && {id:lead.id, projectId:lead.projectId, clientId:lead.project.clientId};
  }
  async columns(actor: ActorContext, board: string, context?: TransactionContext) {
    const rows = await (context ? this.uow.clientFor<Prisma.TransactionClient>(context) : this.prisma).leadColumn.findMany({where:{orgId:actor.orgId, projectId:board},include:columnInclude,orderBy:[{afterStage:{sort:'asc',nulls:'first'}},{position:'asc'},{id:'asc'}]});
    return rows.map(toColumnRecord);
  }
  async createColumn(context: TransactionContext, input: Parameters<LeadRepository['createColumn']>[1]) {
    return toColumnRecord(await this.uow.clientFor<Prisma.TransactionClient>(context).leadColumn.create({data:input,include:columnInclude}));
  }
  async updateColumn(context: TransactionContext, id: string, input: Parameters<LeadRepository['updateColumn']>[2]) {
    return toColumnRecord(await this.uow.clientFor<Prisma.TransactionClient>(context).leadColumn.update({where:{id},data:input,include:columnInclude}));
  }
  async deleteColumn(context: TransactionContext, id: string) {
    await this.uow.clientFor<Prisma.TransactionClient>(context).leadColumn.delete({where:{id}});
  }
  async projectStageCounts(actor: ActorContext, {start, end}: ArrivalWindow) {
    const groups = await this.prisma.lead.groupBy({
      by:['projectId','stage'],
      where:{orgId:actor.orgId, stage:{not:null}, project:reachableProjects(actor), AND:[
        {OR:[{metaSource:{is:{submittedAt:{gte:start, lt:end}}}}, {metaSource:{is:null}, createdAt:{gte:start, lt:end}}]},
      ]},
      _count:{_all:true},
    });
    const projects = new Map<string, ProjectStageCounts>();
    for (const group of groups) {
      if (!group.stage) continue;
      const row = projects.get(group.projectId) ?? {projectId:group.projectId, ...Object.fromEntries(LEAD_STAGES.map(stage => [stage, 0])) as Record<LeadStage, number>};
      row[group.stage] = group._count._all;
      projects.set(group.projectId, row);
    }
    return [...projects.values()].sort((a, b) => a.projectId.localeCompare(b.projectId));
  }
}
