import type { Prisma, PrismaClient } from '@prisma/client';
import { isCustomer } from '@adpulse/access-policy';
import type { ActorContext, TransactionContext } from '#shared/application/index.js';
import type { PrismaUnitOfWork } from '#shared/infrastructure/prisma-unit-of-work.js';
import type { LeadRepository } from '../application/ports.js';

export class PrismaLeadRepository implements LeadRepository {
  constructor(private readonly prisma: PrismaClient, private readonly uow: PrismaUnitOfWork<Prisma.TransactionClient>) {}
  async boards(actor: ActorContext) {
    const clients = await this.prisma.client.findMany({where:{orgId:actor.orgId, ...(actor.role === 'ADMIN' ? {} : {access:{some:{membershipId:actor.membershipId, projectId:null}}})}, orderBy:[{name:'asc'},{id:'asc'}]});
    return [...(isCustomer(actor.role) ? [] : [{key:'agency', label:'Agency'}]), ...clients.map(c => ({key:c.id, label:c.organization || c.name}))];
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
  list(actor: ActorContext, board: string, context?: TransactionContext) {
    return (context ? this.uow.clientFor<Prisma.TransactionClient>(context) : this.prisma).lead.findMany({where:{orgId:actor.orgId, clientId:board === 'agency' ? null : board},orderBy:[{stage:'asc'},{position:'asc'},{id:'asc'}]});
  }
  async lock(context: TransactionContext, actor: ActorContext, board: string) {
    await this.uow.clientFor<Prisma.TransactionClient>(context).$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actor.orgId + ':' + board}, 0))`;
  }
  create(context: TransactionContext, input: Parameters<LeadRepository['create']>[1]) {
    return this.uow.clientFor<Prisma.TransactionClient>(context).lead.create({data:input});
  }
  update(context: TransactionContext, id: string, input: Parameters<LeadRepository['update']>[2]) {
    return this.uow.clientFor<Prisma.TransactionClient>(context).lead.update({where:{id},data:input});
  }
  async delete(context: TransactionContext, id: string) {
    await this.uow.clientFor<Prisma.TransactionClient>(context).lead.delete({where:{id}});
  }
}
