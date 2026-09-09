import type { Prisma, PrismaClient } from "@prisma/client";
import type { ActorContext } from "#shared/application/index.js";
import type { AdLocator } from "../application/ports.js";

function reachableProjects(actor: ActorContext): Prisma.ProjectWhereInput {
  if (actor.role === "ADMIN") return { client: { orgId: actor.orgId } };
  return {
    client: { orgId: actor.orgId },
    OR: [
      { client: { access: { some: { membershipId: actor.membershipId, projectId: null } } } },
      { access: { some: { membershipId: actor.membershipId } } },
    ],
  };
}

export class PrismaAdLocator implements AdLocator {
  constructor(private readonly prisma: PrismaClient) {}

  async locate(actor: ActorContext, adId: string) {
    const row = await this.prisma.ad.findFirst({
      where: { id: adId, adSet: { campaign: { project: reachableProjects(actor) } } },
      select: { externalId: true, adSet: { select: { campaign: { select: { projectId: true } } } } },
    });
    return row && { projectId: row.adSet.campaign.projectId, externalId: row.externalId };
  }
}
