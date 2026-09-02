import { can } from "@adpulse/access-policy";
import { AppError } from "../../../shared/domain/index.js";
import type { ActorContext } from "../../../shared/application/index.js";
import { isOrderedRange, type Ad, type AdSet, type Campaign, type Channel, type DateRange } from "../domain/hierarchy.js";
import { performanceOf, sumByDay, type MeasuredDay, type Performance } from "../domain/metrics.js";
import type { AdRepository, AdSetRepository, CampaignRepository, ProjectReach } from "./ports.js";
import type { MetricRepository } from "./metric-ports.js";

export interface CampaignDependencies {
  readonly campaigns: CampaignRepository;
  readonly adSets: AdSetRepository;
  readonly ads: AdRepository;
  readonly projects: ProjectReach;
  readonly metrics: MetricRepository;
}

export interface WithPerformance<T> {
  readonly performance: Performance;
}

/** One channel's share of the agency, for the source panel. */
export interface ChannelView {
  readonly channel: Channel;
  readonly campaigns: number;
  readonly performance: Performance;
}

/** What identifies a campaign, with none of what it measured. */
export interface CampaignReference {
  readonly id: string;
  readonly name: string;
  readonly channel: Channel;
}

export type CampaignView = Campaign & WithPerformance<Campaign>;
export type AdSetView = AdSet & WithPerformance<AdSet>;
export type AdView = Ad & WithPerformance<Ad>;

const NOT_FOUND = "Campaign not found";

export function createCampaignUseCases(dependencies: CampaignDependencies) {
  /**
   * Read is a matrix question like any other, asked before the range is even
   * validated: a role that may not look at campaigns learns nothing about the
   * shape of the request it sent.
   */
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

  /** Reach first, then the lookup: a refusal must never confirm that a
   * campaign the caller cannot see exists. */
  const reachCampaign = async (actor: ActorContext, id: string): Promise<Campaign> => {
    const campaign = await dependencies.campaigns.findReachable(actor, id);
    if (!campaign) throw new AppError("not-found", NOT_FOUND);
    if (!(await dependencies.projects.isReachable(actor, campaign.projectId))) {
      throw new AppError("not-found", NOT_FOUND);
    }
    return campaign;
  };

  /** An ad set is reachable exactly when its campaign is — reach is inherited
   * downward, never granted at a level of its own. */
  const reachAdSet = async (actor: ActorContext, id: string): Promise<AdSet> => {
    const adSet = await dependencies.adSets.findById(id);
    if (!adSet) throw new AppError("not-found", NOT_FOUND);
    await reachCampaign(actor, adSet.campaignId);
    return adSet;
  };

  const campaignPerformance = async (id: string, range: DateRange): Promise<Performance> =>
    performanceOf(await dependencies.metrics.readCampaignRange(id, range.from, range.to));

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

    /**
     * A project's campaigns as references, for choosing one.
     *
     * Deliberately not the listing above with the figures dropped: computing
     * every campaign's sums to render a picker would read what nobody looks at,
     * and would make the list depend on a period the chooser never named.
     */
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

    /** The measured days themselves, for the chart. Not summed: the shape over
     * time is the whole point of it. */
    dailySeries: async (actor: ActorContext, campaignId: string, range: DateRange) => {
      assertCanRead(actor);
      assertRange(range);
      await reachCampaign(actor, campaignId);
      return dependencies.metrics.readCampaignRange(campaignId, range.from, range.to);
    },

    /** A project measures nothing itself, so its shape over time is its
     * campaigns' days added up per date. */
    projectDailySeries: async (
      actor: ActorContext, projectId: string, range: DateRange,
    ): Promise<MeasuredDay[]> => {
      assertCanRead(actor);
      assertRange(range);
      if (!(await dependencies.projects.isReachable(actor, projectId))) {
        throw new AppError("not-found", "Project not found");
      }
      const campaigns = await dependencies.campaigns.listReachableByProject(actor, projectId);
      const days = await Promise.all(campaigns.map((campaign) =>
        dependencies.metrics.readCampaignRange(campaign.id, range.from, range.to)));
      return sumByDay(days.flat());
    },

    /**
     * A project is the sum of its campaigns. It measures nothing itself — the
     * platforms have no opinion about our groupings.
     */
    projectSummary: async (
      actor: ActorContext, projectId: string, range: DateRange,
    ): Promise<Performance> => {
      assertCanRead(actor);
      assertRange(range);
      if (!(await dependencies.projects.isReachable(actor, projectId))) {
        throw new AppError("not-found", "Project not found");
      }
      const campaigns = await dependencies.campaigns.listReachableByProject(actor, projectId);
      const days = await Promise.all(campaigns.map((campaign) =>
        dependencies.metrics.readCampaignRange(campaign.id, range.from, range.to)));
      return performanceOf(days.flat());
    },

    /**
     * The agency split by channel, biggest spend first.
     *
     * Only channels the member actually reaches a campaign on: an empty row for
     * every platform we support would suggest we run there and got nothing.
     */
    channelSummary: async (actor: ActorContext, range: DateRange): Promise<ChannelView[]> => {
      assertCanRead(actor);
      assertRange(range);
      const campaigns = await dependencies.campaigns.listReachable(actor);
      const byChannel = new Map<Channel, MeasuredDay[]>();
      const counts = new Map<Channel, number>();
      for (const campaign of campaigns) {
        const days = await dependencies.metrics.readCampaignRange(campaign.id, range.from, range.to);
        byChannel.set(campaign.channel, [...(byChannel.get(campaign.channel) ?? []), ...days]);
        counts.set(campaign.channel, (counts.get(campaign.channel) ?? 0) + 1);
      }
      return [...byChannel.entries()]
        .map(([channel, days]) => ({
          channel,
          campaigns: counts.get(channel) ?? 0,
          performance: performanceOf(days),
        }))
        .sort((a, b) => b.performance.spend - a.performance.spend);
    },

    /** This member's view of the agency, not the agency's total: a project they
     * hold no grant over contributes nothing. */
    agencySummary: async (actor: ActorContext, range: DateRange): Promise<Performance> => {
      assertCanRead(actor);
      assertRange(range);
      const campaigns = await dependencies.campaigns.listReachable(actor);
      const days = await Promise.all(campaigns.map((campaign) =>
        dependencies.metrics.readCampaignRange(campaign.id, range.from, range.to)));
      return performanceOf(days.flat());
    },
  };
}

export type CampaignUseCases = ReturnType<typeof createCampaignUseCases>;
