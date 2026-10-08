import type { PrismaClient } from "@prisma/client";
import type { ActorContext } from "#shared/application/index.js";
import type { AdLocator } from "../application/ports.js";
import { reachableProjects } from "#shared/infrastructure/project-reach.js";

export class PrismaAdLocator implements AdLocator {
  constructor(private readonly prisma: PrismaClient) {}

  async locate(actor: ActorContext, adId: string) {
    const row = await this.prisma.ad.findFirst({
      where: { id: adId, adSet: { campaign: { project: reachableProjects(actor) } } },
      select: { externalId: true, adSet: { select: { campaign: { select: { projectId: true, sourceAccountId: true } } } } },
    });
    return row && { projectId: row.adSet.campaign.projectId, externalId: row.externalId, accountId: row.adSet.campaign.sourceAccountId };
  }
}
