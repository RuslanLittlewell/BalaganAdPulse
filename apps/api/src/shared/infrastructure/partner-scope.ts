import type { PrismaClient } from '@prisma/client';
import type { ActorContext } from '#shared/application/index.js';

export async function partnerForMembership(prisma: PrismaClient, membershipId: string, orgId: string): Promise<ActorContext['partner']> {
  const links = await prisma.partnerCampaign.findMany({
    where: { membershipId, membership: { orgId, role: 'PARTNER' }, campaign: { project: { client: { orgId } } } },
    select: { campaign: { select: { id: true, projectId: true } } },
    orderBy: [{ campaign: { projectId: 'asc' } }, { campaignId: 'asc' }],
  });
  const projectId = links[0]?.campaign.projectId;
  if (!projectId) return undefined;
  return { campaignIds: links.filter((link) => link.campaign.projectId === projectId).map((link) => link.campaign.id), projectId };
}
