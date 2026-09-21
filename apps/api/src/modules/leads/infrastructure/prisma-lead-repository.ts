import type { Prisma, PrismaClient } from '@prisma/client';
import { isCustomer } from '@adpulse/access-policy';
import type { ActorContext, TransactionContext } from '#shared/application/index.js';
import type { PrismaUnitOfWork } from '#shared/infrastructure/prisma-unit-of-work.js';
import type { LeadRepository } from '../application/ports.js';
import { LEAD_STAGES, placementOf, type ArrivalWindow, type LeadAnswer, type LeadRecord, type LeadStage, type ProjectStageCounts } from '../domain/lead.js';

export const leadInclude = {
  ad:{select:{id:true,name:true,externalId:true}},
  project:{select:{id:true,clientId:true,name:true}},
  assignee:{select:{id:true,user:{select:{name:true,image:true}}}},
  metaSource:true,
} satisfies Prisma.LeadInclude;
type LeadRow = Prisma.LeadGetPayload<{include:typeof leadInclude}>;

export function toLeadRecord({metaSource, columnId, assignee, ...lead}: LeadRow): LeadRecord {
  return {...lead, assignee:assignee&&{id:assignee.id,name:assignee.user.name,image:assignee.user.image}, stage: lead.stage ?? columnId ?? 'NEW', metaSource: metaSource && {
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
    const clients = await this.prisma.client.findMany({where:{orgId:actor.orgId, ...(actor.role === 'ADMIN' ? {} : {access:{some:{membershipId:actor.membershipId, projectId:null}}})}, orderBy:[{name:'asc'},{id:'asc'}]});
    return [...(isCustomer(actor.role) ? [] : [{key:'agency', label:'Agency'}]), ...clients.map(c => ({key:c.id, label:c.name}))];
  }
  async reaches(actor: ActorContext, board: string) {
    return (await this.boards(actor)).some(b => b.key === board);
  }
  async reachesProject(actor: ActorContext, board: string, projectId: string) {
    const project = await this.prisma.project.findFirst({where:{id:projectId, client:{orgId:actor.orgId}}, select:{clientId:true}});
    if (!project) return false;
    return board === 'agency' ? await this.reaches(actor, 'agency') : project.clientId === board;
  }
  async campaignInProject(campaignId: string, projectId: string) {
    return (await this.prisma.campaign.count({where:{id:campaignId, projectId}})) > 0;
  }
  async assigneeReachesBoard(orgId: string, membershipId: string, board: string, projectId: string | null) {
    if (board === 'agency' && !projectId) return false;
    const access = board === 'agency'
      ? {OR:[{projectId},{client:{projects:{some:{id:projectId!}}}}]}
      : {OR:[{clientId:board},{project:{clientId:board}}]};
    return (await this.prisma.membership.count({where:{id:membershipId,orgId,status:'ACTIVE',access:{some:access}}})) > 0;
  }
  async list(actor: ActorContext, board: string, context?: TransactionContext) {
    const rows = await (context ? this.uow.clientFor<Prisma.TransactionClient>(context) : this.prisma).lead.findMany({where:{orgId:actor.orgId, clientId:board === 'agency' ? null : board},include:leadInclude,orderBy:[{stage:{sort:'asc',nulls:'last'}},{column:{position:'asc'}},{position:'asc'},{id:'asc'}]});
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
    await this.uow.clientFor<Prisma.TransactionClient>(context).lead.delete({where:{id}});
  }
  async columns(actor: ActorContext, board: string, context?: TransactionContext) {
    return (context ? this.uow.clientFor<Prisma.TransactionClient>(context) : this.prisma).leadColumn.findMany({where:{orgId:actor.orgId, clientId:board === 'agency' ? null : board},orderBy:[{afterStage:{sort:'asc',nulls:'first'}},{position:'asc'},{id:'asc'}]});
  }
  async createColumn(context: TransactionContext, input: Parameters<LeadRepository['createColumn']>[1]) {
    return this.uow.clientFor<Prisma.TransactionClient>(context).leadColumn.create({data:input});
  }
  async updateColumn(context: TransactionContext, id: string, input: Parameters<LeadRepository['updateColumn']>[2]) {
    return this.uow.clientFor<Prisma.TransactionClient>(context).leadColumn.update({where:{id},data:input});
  }
  async deleteColumn(context: TransactionContext, id: string) {
    await this.uow.clientFor<Prisma.TransactionClient>(context).leadColumn.delete({where:{id}});
  }
  async projectStageCounts(actor: ActorContext, {start, end}: ArrivalWindow) {
    const boards = await this.boards(actor);
    const clientIds = boards.filter(b => b.key !== 'agency').map(b => b.key);
    const onReachableBoards: Prisma.LeadWhereInput[] = [{clientId:{in:clientIds}}, ...(boards.some(b => b.key === 'agency') ? [{clientId:null}] : [])];
    const groups = await this.prisma.lead.groupBy({
      by:['projectId','stage'],
      where:{orgId:actor.orgId, projectId:{not:null}, stage:{not:null}, AND:[
        {OR:onReachableBoards},
        {OR:[{metaSource:{is:{submittedAt:{gte:start, lt:end}}}}, {metaSource:{is:null}, createdAt:{gte:start, lt:end}}]},
      ]},
      _count:{_all:true},
    });
    const projects = new Map<string, ProjectStageCounts>();
    for (const group of groups) {
      if (!group.projectId || !group.stage) continue;
      const row = projects.get(group.projectId) ?? {projectId:group.projectId, ...Object.fromEntries(LEAD_STAGES.map(stage => [stage, 0])) as Record<LeadStage, number>};
      row[group.stage] = group._count._all;
      projects.set(group.projectId, row);
    }
    return [...projects.values()].sort((a, b) => a.projectId.localeCompare(b.projectId));
  }
}
