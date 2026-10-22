import { can } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import { isOrderedRange, type Ad, type AdSet, type Campaign, type Channel, type CreativeFile, type DateRange, type ProjectKpi } from "../domain/hierarchy.js";
import { performanceOf, sumByDay, type MeasuredDay, type Performance } from "../domain/metrics.js";
import type { AdRepository, AdSetRepository, CampaignRepository, CreativeRepository, CreativeStorage, ProjectReach } from "./ports.js";
import type { CampaignDay, MetricRepository } from "./metric-ports.js";

export interface CampaignDependencies {
  readonly campaigns: CampaignRepository;
  readonly adSets: AdSetRepository;
  readonly ads: AdRepository;
  readonly creatives: CreativeRepository;
  readonly creativeFiles: CreativeStorage;
  readonly projects: ProjectReach;
  readonly metrics: MetricRepository;
}

export interface WithPerformance<T> {
  readonly performance: Performance;
}

export interface CurrencyPerformance {
  readonly currency: string | null;
  readonly performance: Performance;
}

export interface ChannelView {
  readonly currency: string | null;
  readonly channel: Channel;
  readonly campaigns: number;
  readonly performance: Performance;
}

export interface ProjectFigures {
  readonly projectId: string;
  readonly kpis: ProjectKpi[];
  readonly performance: Performance;
  readonly days: MeasuredDay[];
}

export interface CampaignReference {
  readonly id: string;
  readonly name: string;
  readonly channel: Channel;
}

export type CampaignView = Campaign & WithPerformance<Campaign>;
export type AdSetView = AdSet & WithPerformance<AdSet>;
export type AdView = Ad & WithPerformance<Ad>;

const NOT_FOUND = "Campaign not found";

function groupedBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item]);
  return groups;
}

export function createCampaignUseCases(dependencies: CampaignDependencies) {
  const assertCanRead = (actor: ActorContext) => {
    if (!can(actor, "read", "campaign")) {
      throw new AppError("forbidden", "Your role may not read a campaign");
    }
  };

  const assertRange = (range: DateRange) => {
    if (!isOrderedRange(range)) {
      throw new AppError("validation", "The range ends before it starts");
    }
  };

  const reachCampaign = async (actor: ActorContext, id: string): Promise<Campaign> => {
    const campaign = await dependencies.campaigns.findReachable(actor, id);
    if (!campaign) throw new AppError("not-found", NOT_FOUND);
    if (!(await dependencies.projects.isReachable(actor, campaign.projectId))) {
      throw new AppError("not-found", NOT_FOUND);
    }
    return campaign;
  };

  const reachAdSet = async (actor: ActorContext, id: string): Promise<AdSet> => {
    const adSet = await dependencies.adSets.findById(id);
    if (!adSet) throw new AppError("not-found", NOT_FOUND);
    await reachCampaign(actor, adSet.campaignId);
    return adSet;
  };

  const campaignPerformance = async (id: string, range: DateRange): Promise<Performance> =>
    performanceOf(await dependencies.metrics.readCampaignRange(id, range.from, range.to));

  const campaignDays = (campaigns: readonly Campaign[], range: DateRange): Promise<CampaignDay[]> =>
    dependencies.metrics.readCampaignsRange(campaigns.map((campaign) => campaign.id), range.from, range.to);

  const reachableProjectCampaigns = async (actor: ActorContext, projectId: string): Promise<Campaign[]> => {
    if (!(await dependencies.projects.isReachable(actor, projectId))) {
      throw new AppError("not-found", "Project not found");
    }
    return dependencies.campaigns.listReachableByProject(actor, projectId);
  };

  return {
    readCampaign: async (actor: ActorContext, id: string, range: DateRange): Promise<CampaignView> => {
      assertCanRead(actor);
      assertRange(range);
      const campaign = await reachCampaign(actor, id);
      return { ...campaign, performance: await campaignPerformance(id, range) };
    },

    listCampaigns: async (
      actor: ActorContext, projectId: string, range: DateRange,
    ): Promise<CampaignView[]> => {
      assertCanRead(actor);
      assertRange(range);
      if (!(await dependencies.projects.isReachable(actor, projectId))) {
        throw new AppError("not-found", "Project not found");
      }
      const campaigns = await dependencies.campaigns.listReachableByProject(actor, projectId);
      return Promise.all(campaigns.map(async (campaign) => ({
        ...campaign,
        performance: await campaignPerformance(campaign.id, range),
      })));
    },

    listCampaignReferences: async (
      actor: ActorContext, projectId: string,
    ): Promise<CampaignReference[]> => {
      assertCanRead(actor);
      if (!(await dependencies.projects.isReachable(actor, projectId))) {
        throw new AppError("not-found", "Project not found");
      }
      const campaigns = await dependencies.campaigns.listReachableByProject(actor, projectId);
      return campaigns.map(({ id, name, channel }) => ({ id, name, channel }));
    },

    listAdSets: async (
      actor: ActorContext, campaignId: string, range: DateRange,
    ): Promise<AdSetView[]> => {
      assertCanRead(actor);
      assertRange(range);
      await reachCampaign(actor, campaignId);
      const adSets = await dependencies.adSets.listByCampaign(campaignId);
      return Promise.all(adSets.map(async (adSet) => ({
        ...adSet,
        performance: performanceOf(
          await dependencies.metrics.readAdSetRange(adSet.id, range.from, range.to),
        ),
      })));
    },

    listAds: async (actor: ActorContext, adSetId: string, range: DateRange): Promise<AdView[]> => {
      assertCanRead(actor);
      assertRange(range);
      await reachAdSet(actor, adSetId);
      const ads = await dependencies.ads.listByAdSet(adSetId);
      return Promise.all(ads.map(async (ad) => ({
        ...ad,
        performance: performanceOf(await dependencies.metrics.readAdRange(ad.id, range.from, range.to)),
      })));
    },

    readCreativeFile: async (
      actor: ActorContext,
      id: string,
      part: "file" | "poster",
    ): Promise<CreativeFile> => {
      assertCanRead(actor);
      const stored = await dependencies.creatives.findFile(actor, id, part);
      if (!stored) throw new AppError("not-found", "Creative not found");
      try {
        const object = await dependencies.creativeFiles.read(stored.key);
        return { body: object.body, contentType: object.contentType ?? stored.contentType };
      } catch {
        throw new AppError("not-found", "Creative not found");
      }
    },

    dailySeries: async (actor: ActorContext, campaignId: string, range: DateRange) => {
      assertCanRead(actor);
      assertRange(range);
      await reachCampaign(actor, campaignId);
      return dependencies.metrics.readCampaignRange(campaignId, range.from, range.to);
    },

    projectDailySeries: async (
      actor: ActorContext, projectId: string, range: DateRange,
    ): Promise<MeasuredDay[]> => {
      assertCanRead(actor);
      assertRange(range);
      return sumByDay(await campaignDays(await reachableProjectCampaigns(actor, projectId), range));
    },

    projectSummary: async (
      actor: ActorContext, projectId: string, range: DateRange,
    ): Promise<Performance> => {
      assertCanRead(actor);
      assertRange(range);
      return performanceOf(await campaignDays(await reachableProjectCampaigns(actor, projectId), range));
    },

    projectsSummary: async (actor: ActorContext, range: DateRange): Promise<ProjectFigures[]> => {
      assertCanRead(actor);
      assertRange(range);
      const [projects, campaigns] = await Promise.all([
        dependencies.projects.listReachable(actor),
        dependencies.campaigns.listReachable(actor),
      ]);
      const campaignsByProject = groupedBy(campaigns, (campaign) => campaign.projectId);
      const daysByCampaign = groupedBy(await campaignDays(campaigns, range), (day) => day.campaignId);
      return projects.map(({ id, kpis }) => {
        const days = (campaignsByProject.get(id) ?? [])
          .flatMap((campaign) => daysByCampaign.get(campaign.id) ?? []);
        return { projectId: id, kpis, performance: performanceOf(days), days: sumByDay(days) };
      });
    },

    channelSummary: async (actor: ActorContext, range: DateRange): Promise<ChannelView[]> => {
      assertCanRead(actor);
      assertRange(range);
      const campaigns = await dependencies.campaigns.listReachable(actor);
      const daysByCampaign = groupedBy(await campaignDays(campaigns, range), (day) => day.campaignId);
      const groups = new Map<string, { channel: Channel; currency: string | null; campaigns: number; days: MeasuredDay[] }>();
      for (const campaign of campaigns) {
        const currency = campaign.currency ?? null;
        const key = JSON.stringify([campaign.channel, currency]);
        const group = groups.get(key) ?? { channel: campaign.channel, currency, campaigns: 0, days: [] };
        group.days.push(...(daysByCampaign.get(campaign.id) ?? []));
        group.campaigns += 1;
        groups.set(key, group);
      }
      return [...groups.values()].map(({ days, ...group }) => ({ ...group, performance: performanceOf(days) }))
        .sort((a, b) => (a.currency ?? "").localeCompare(b.currency ?? "") || b.performance.spend - a.performance.spend);
    },

    agencySummary: async (actor: ActorContext, range: DateRange): Promise<CurrencyPerformance[]> => {
      assertCanRead(actor);
      assertRange(range);
      const campaigns = await dependencies.campaigns.listReachable(actor);
      const daysByCampaign = groupedBy(await campaignDays(campaigns, range), (day) => day.campaignId);
      const groups = new Map<string | null, MeasuredDay[]>();
      for (const campaign of campaigns) {
        const currency = campaign.currency ?? null;
        groups.set(currency, [...(groups.get(currency) ?? []), ...(daysByCampaign.get(campaign.id) ?? [])]);
      }
      return [...groups].map(([currency, days]) => ({ currency, performance: performanceOf(days) }));
    },
  };
}

export type CampaignUseCases = ReturnType<typeof createCampaignUseCases>;
