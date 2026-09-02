import type { Prisma, PrismaClient } from "@prisma/client";
import type { ActorContext } from "../../../shared/application/index.js";
import type { Ad, AdSet, Campaign } from "../domain/hierarchy.js";
import type {
  AdRepository, AdSetRepository, CampaignRepository, ProjectReach,
} from "../application/ports.js";

/**
 * Which projects this actor reaches, as a query filter.
 *
 * An admin reaches their whole organization. Anyone else reaches a project
 * either through a grant over its client — every project of that client — or
 * through a grant over the project itself.
 */
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

const toCampaign = (row: {
  id: string; projectId: string; name: string; channel: string; status: string;
  objective: string | null; externalId: string | null; position: number;
}): Campaign => ({
  id: row.id,
  projectId: row.projectId,
  name: row.name,
  channel: row.channel as Campaign["channel"],
  status: row.status as Campaign["status"],
  objective: row.objective,
  externalId: row.externalId,
  position: row.position,
});

export class PrismaCampaignRepository implements CampaignRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findReachable(actor: ActorContext, id: string): Promise<Campaign | null> {
    const row = await this.prisma.campaign.findFirst({
      where: { id, project: reachableProjects(actor) },
    });
    return row && toCampaign(row);
  }

  async listReachableByProject(actor: ActorContext, projectId: string): Promise<Campaign[]> {
    const rows = await this.prisma.campaign.findMany({
      where: { projectId, project: reachableProjects(actor) },
      orderBy: { position: "asc" },
    });
    return rows.map(toCampaign);
  }

  async listReachable(actor: ActorContext): Promise<Campaign[]> {
    const rows = await this.prisma.campaign.findMany({
      where: { project: reachableProjects(actor) },
      orderBy: [{ projectId: "asc" }, { position: "asc" }],
    });
    return rows.map(toCampaign);
  }
}

/** No reach filter of its own: an ad set is reachable exactly when its campaign
 * is, and the use case checks that before it asks for one. */
export class PrismaAdSetRepository implements AdSetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByCampaign(campaignId: string): Promise<AdSet[]> {
    const rows = await this.prisma.adSet.findMany({
      where: { campaignId }, orderBy: { position: "asc" },
    });
    return rows.map((row) => ({ ...row, status: row.status as AdSet["status"] }));
  }

  async findById(id: string): Promise<AdSet | null> {
    const row = await this.prisma.adSet.findUnique({ where: { id } });
    return row && { ...row, status: row.status as AdSet["status"] };
  }
}

export class PrismaAdRepository implements AdRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByAdSet(adSetId: string): Promise<Ad[]> {
    const rows = await this.prisma.ad.findMany({
      where: { adSetId }, orderBy: { position: "asc" },
    });
    return rows.map((row) => ({ ...row, status: row.status as Ad["status"] }));
  }
}

export class PrismaProjectReach implements ProjectReach {
  constructor(private readonly prisma: PrismaClient) {}

  async isReachable(actor: ActorContext, projectId: string): Promise<boolean> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ...reachableProjects(actor) }, select: { id: true },
    });
    return project !== null;
  }
}

/**
 * Whether a campaign sits under a given project.
 *
 * No reach filter of its own: the caller has already established that the actor
 * reaches the project, and a campaign is reachable exactly when its project is.
 * Asking about a campaign of some other project answers false, which is the same
 * answer an unknown id gets — deliberately, so neither confirms the other exists.
 */
export class PrismaCampaignInProject {
  constructor(private readonly prisma: PrismaClient) {}

  async isInProject(campaignId: string, projectId: string): Promise<boolean> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, projectId }, select: { id: true },
    });
    return campaign !== null;
  }
}
