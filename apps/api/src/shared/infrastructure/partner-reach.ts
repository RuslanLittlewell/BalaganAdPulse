import type { Prisma } from '@prisma/client';
import type { ActorContext } from '#shared/application/index.js';
import { reachableProjects } from './project-reach.js';

const partnerCampaigns = (actor: ActorContext) => ({ in: [...(actor.partner?.campaignIds ?? [])] });

export function reachableCampaigns(actor: ActorContext): Prisma.CampaignWhereInput {
  return { project: reachableProjects(actor), ...(actor.role === 'PARTNER' ? { id: partnerCampaigns(actor) } : {}) };
}

export function visibleLeads(actor: ActorContext): Prisma.LeadWhereInput {
  return { orgId: actor.orgId, project: reachableProjects(actor), ...(actor.role === 'PARTNER' ? { campaignId: partnerCampaigns(actor) } : {}) };
}

export function visibleRecords(actor: ActorContext): Prisma.PersonWhereInput & Prisma.CompanyWhereInput {
  return actor.role === 'PARTNER' ? { leads: { some: visibleLeads(actor) } } : {};
}
