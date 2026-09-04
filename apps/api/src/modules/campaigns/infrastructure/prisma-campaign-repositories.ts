import type { Prisma, PrismaClient } from "@prisma/client";
import type { ActorContext } from "../../../shared/application/index.js";
import type { Ad, AdSet, Campaign } from "../domain/hierarchy.js";
import type {
  AdRepository, AdSetRepository, CampaignRepository, ProjectReach,
} from "../application/ports.js";

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

export class PrismaCampaignInProject {
  constructor(private readonly prisma: PrismaClient) {}

  async isInProject(campaignId: string, projectId: string): Promise<boolean> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, projectId }, select: { id: true },
    });
    return campaign !== null;
  }
}
