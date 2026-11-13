import type { PrismaClient } from '@prisma/client';
import type { ActorContext } from '#shared/application/index.js';

export async function partnerForMembership(prisma: PrismaClient, membershipId: string, orgId: string): Promise<ActorContext['partner']> {
  const row = await prisma.membership.findFirst({
    where: { id: membershipId, orgId, role: 'PARTNER', campaign: { project: { client: { orgId } } } },
    select: { campaign: { select: { id: true, projectId: true } } },
  });
  return row?.campaign ? { campaignId: row.campaign.id, projectId: row.campaign.projectId } : undefined;
}
