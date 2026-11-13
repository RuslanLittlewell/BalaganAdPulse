import type { Prisma } from '@prisma/client';
import type { ActorContext } from '#shared/application/index.js';
import { reachableProjects } from './project-reach.js';

const partnerCampaign = (actor: ActorContext) => actor.partner?.campaignId ?? '';

export function reachableCampaigns(actor: ActorContext): Prisma.CampaignWhereInput {
  return { project: reachableProjects(actor), ...(actor.role === 'PARTNER' ? { id: partnerCampaign(actor) } : {}) };
}

export function visibleLeads(actor: ActorContext): Prisma.LeadWhereInput {
  return { orgId: actor.orgId, project: reachableProjects(actor), ...(actor.role === 'PARTNER' ? { campaignId: partnerCampaign(actor) } : {}) };
}

export function visibleRecords(actor: ActorContext): Prisma.PersonWhereInput & Prisma.CompanyWhereInput {
  return actor.role === 'PARTNER' ? { leads: { some: visibleLeads(actor) } } : {};
}
