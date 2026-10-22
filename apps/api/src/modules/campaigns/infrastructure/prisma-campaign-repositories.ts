import type { PrismaClient } from "@prisma/client";
import type { ActorContext } from "#shared/application/index.js";
import { getObject } from "#shared/infrastructure/storage.js";
import type { Ad, AdSet, Campaign, KpiTarget, ProjectKpi } from "../domain/hierarchy.js";
import type {
  AdRepository, AdSetRepository, CampaignRepository, CreativeRepository, CreativeStorage, ProjectReach, ReachableProject,
} from "../application/ports.js";
import { reachableProjects } from "#shared/infrastructure/project-reach.js";

type StoredKpi = { kpiMetric: string | null; kpiTarget: { toFixed(digits: number): string } | null };

const kpiOf = ({ kpiMetric, kpiTarget }: StoredKpi): KpiTarget | null =>
  kpiMetric && kpiTarget ? { metric: kpiMetric, target: kpiTarget.toFixed(4) } : null;

type StoredProjectKpi = {
  metric: string;
  target: { toFixed(digits: number): string };
  name: string | null;
  value: { toFixed(digits: number): string } | null;
  enabled: boolean;
};

const projectKpiOf = (row: StoredProjectKpi): ProjectKpi | null => {
  const kpi = { metric: row.metric, target: row.target.toFixed(4), enabled: row.enabled };
  if (kpi.metric !== "MANUAL") return kpi;
  return row.name != null && row.value ? { ...kpi, name: row.name, value: row.value.toFixed(4) } : null;
};

const toCampaign = (row: StoredKpi & {
  id: string; projectId: string; name: string; channel: string; status: string;
  objective: string | null; externalId: string | null; sourceAccountId: string | null; position: number;
  project?: { budgetCurrency: string | null };
}): Campaign => ({
  currency: row.project?.budgetCurrency ?? null,
  id: row.id,
  projectId: row.projectId,
  name: row.name,
  channel: row.channel as Campaign["channel"],
  status: row.status as Campaign["status"],
  objective: row.objective,
  externalId: row.externalId,
  sourceAccountId: row.sourceAccountId,
  position: row.position,
  kpi: kpiOf(row),
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
      include: { project: { select: { budgetCurrency: true } } },
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

export class PrismaCreativeRepository implements CreativeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findFile(
    actor: ActorContext,
    id: string,
    part: "file" | "poster",
  ): Promise<{ key: string; contentType: string } | null> {
    const row = await this.prisma.adCreative.findFirst({
      where: { id, ad: { adSet: { campaign: { project: reachableProjects(actor) } } } },
    });
    if (!row) return null;
    const key = part === "file" ? row.fileKey : row.posterKey;
    if (!key) return null;
    const contentType = part === "file" ? row.contentType : row.posterContentType;
    return { key, contentType: contentType ?? "application/octet-stream" };
  }
}

export class S3CreativeStorage implements CreativeStorage {
  read(key: string) {
    return getObject(key);
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

  async listReachable(actor: ActorContext): Promise<ReachableProject[]> {
    const projects = await this.prisma.project.findMany({
      where: reachableProjects(actor),
      select: {
        id: true,
        kpiTracked: true,
        kpis: { select: { metric: true, target: true, name: true, value: true, enabled: true }, orderBy: { position: "asc" } },
      },
      orderBy: { position: "asc" },
    });
    return projects.map((project) => ({ id: project.id, kpis: project.kpiTracked ? project.kpis.flatMap((kpi) => projectKpiOf(kpi) ?? []) : [] }));
  }
}
