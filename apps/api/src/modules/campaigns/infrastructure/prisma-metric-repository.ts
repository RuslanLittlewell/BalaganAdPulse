import type { Prisma, PrismaClient } from "@prisma/client";
import type { MeasuredDay } from "../domain/metrics.js";
import {
  resultTypeOfGoal,
  typedByCategory,
  typesOfCategories,
  type CampaignCategories,
  type CampaignResultKind,
  type CategoryResult,
  type TypedDay,
} from "../domain/result-type.js";
import type { CampaignChannel, CampaignDay, MetricRepository } from "../application/metric-ports.js";

interface StoredRow {
  date: Date;
  spend: Prisma.Decimal;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  results: number;
  revenue: Prisma.Decimal;
}

const toMeasured = (row: StoredRow): MeasuredDay => ({
  date: row.date,
  spend: row.spend.toNumber(),
  impressions: row.impressions,
  reach: row.reach,
  clicks: row.clicks,
  conversions: row.conversions,
  results: row.results,
  revenue: row.revenue.toNumber(),
});

const within = (from: Date, to: Date) => ({ gte: from, lte: to });

const resultOf = (row: { date: Date; category: string; results: Prisma.Decimal }): CategoryResult =>
  ({ date: row.date, category: row.category, results: row.results.toNumber() });

export class PrismaMetricRepository implements MetricRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async readCampaignRange(campaignId: string, from: Date, to: Date): Promise<MeasuredDay[]> {
    const rows = await this.prisma.campaignDailyMetric.findMany({
      where: { campaignId, date: within(from, to) },
      orderBy: { date: "asc" },
    });
    return rows.map(toMeasured);
  }

  async readCampaignsRange(campaignIds: readonly string[], from: Date, to: Date): Promise<CampaignDay[]> {
    if (campaignIds.length === 0) return [];
    const rows = await this.prisma.campaignDailyMetric.findMany({
      where: { campaignId: { in: [...campaignIds] }, date: within(from, to) },
      orderBy: { date: "asc" },
    });
    return rows.map((row) => ({ campaignId: row.campaignId, ...toMeasured(row) }));
  }

  async readAdSetRange(adSetId: string, from: Date, to: Date): Promise<MeasuredDay[]> {
    const rows = await this.prisma.adSetDailyMetric.findMany({
      where: { adSetId, date: within(from, to) },
      orderBy: { date: "asc" },
    });
    return rows.map(toMeasured);
  }

  async readTypedDays(campaigns: readonly CampaignChannel[], from: Date, to: Date): Promise<TypedDay[]> {
    if (campaigns.length === 0) return [];
    const categorised = new Map((await this.readConversionCategories(
      campaigns.filter((campaign) => campaign.channel === "GOOGLE").map((campaign) => campaign.id),
    )).filter(({ categories }) => categories.length > 0).map(({ campaignId, categories }) => [campaignId, categories]));
    const google = campaigns
      .filter((campaign) => campaign.channel === "GOOGLE" && !categorised.has(campaign.id))
      .map((campaign) => campaign.id);
    const others = campaigns.filter((campaign) => campaign.channel !== "GOOGLE").map((campaign) => campaign.id);
    const withAdSets = new Set((await this.prisma.adSet.findMany({
      where: { campaignId: { in: others } }, select: { campaignId: true }, distinct: ["campaignId"],
    })).map((row) => row.campaignId));
    const bare = others.filter((id) => !withAdSets.has(id));
    const [adSetDays, campaignDays] = await Promise.all([
      withAdSets.size === 0 ? [] : this.prisma.adSetDailyMetric.findMany({
        where: { date: within(from, to), adSet: { campaignId: { in: [...withAdSets] } } },
        select: { date: true, results: true, spend: true, adSet: { select: { campaignId: true, optimizationGoal: true } } },
      }),
      google.length + bare.length === 0 ? [] : this.prisma.campaignDailyMetric.findMany({
        where: { date: within(from, to), campaignId: { in: [...google, ...bare] } },
        select: { campaignId: true, date: true, results: true, spend: true },
      }),
    ]);
    const googleIds = new Set(google);
    return [
      ...await this.readCategorisedDays(categorised, from, to),
      ...adSetDays.map((row) => ({
        campaignId: row.adSet.campaignId, date: row.date, type: resultTypeOfGoal(row.adSet.optimizationGoal),
        results: row.results, spend: row.spend.toNumber(),
      })),
      ...campaignDays.map((row) => ({
        campaignId: row.campaignId, date: row.date, type: googleIds.has(row.campaignId) ? "CONVERSIONS" as const : "UNKNOWN" as const,
        results: row.results, spend: row.spend.toNumber(),
      })),
    ];
  }

  private async readCategorisedDays(categorised: ReadonlyMap<string, readonly string[]>, from: Date, to: Date): Promise<TypedDay[]> {
    if (categorised.size === 0) return [];
    const campaignIds = [...categorised.keys()];
    const [days, results] = await Promise.all([
      this.prisma.campaignDailyMetric.findMany({
        where: { campaignId: { in: campaignIds }, date: within(from, to) },
        select: { campaignId: true, date: true, spend: true },
      }),
      this.prisma.campaignDailyResult.findMany({
        where: { campaignId: { in: campaignIds }, date: within(from, to) },
        select: { campaignId: true, date: true, category: true, results: true },
      }),
    ]);
    return campaignIds.flatMap((campaignId) => typedByCategory(
      days.filter((day) => day.campaignId === campaignId).map((day) => ({ date: day.date, spend: day.spend.toNumber() })),
      results.filter((result) => result.campaignId === campaignId).map(resultOf),
      typesOfCategories(categorised.get(campaignId) ?? []),
    ).map((figure) => ({ ...figure, campaignId })));
  }

  async readConversionCategories(campaignIds: readonly string[]): Promise<CampaignCategories[]> {
    if (campaignIds.length === 0) return [];
    const rows = await this.prisma.campaign.findMany({
      where: { id: { in: [...campaignIds] } }, select: { id: true, conversionCategories: true },
    });
    return rows.map((row) => ({ campaignId: row.id, categories: row.conversionCategories }));
  }

  async readAdSetResults(adSetId: string, from: Date, to: Date): Promise<CategoryResult[]> {
    const rows = await this.prisma.adSetDailyResult.findMany({ where: { adSetId, date: within(from, to) } });
    return rows.map(resultOf);
  }

  async readAdResults(adId: string, from: Date, to: Date): Promise<CategoryResult[]> {
    const rows = await this.prisma.adDailyResult.findMany({ where: { adId, date: within(from, to) } });
    return rows.map(resultOf);
  }

  async readResultKinds(campaignIds: readonly string[]): Promise<CampaignResultKind[]> {
    if (campaignIds.length === 0) return [];
    return this.prisma.adSet.findMany({
      where: { campaignId: { in: [...campaignIds] } },
      select: { campaignId: true, optimizationGoal: true },
      distinct: ["campaignId", "optimizationGoal"],
    });
  }

  async readAdRange(adId: string, from: Date, to: Date): Promise<MeasuredDay[]> {
    const rows = await this.prisma.adDailyMetric.findMany({
      where: { adId, date: within(from, to) },
      orderBy: { date: "asc" },
    });
    return rows.map(toMeasured);
  }
}
