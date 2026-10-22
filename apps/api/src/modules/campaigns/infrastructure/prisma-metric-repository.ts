import type { Prisma, PrismaClient } from "@prisma/client";
import type { MeasuredDay } from "../domain/metrics.js";
import { resultTypeOfGoal, type CampaignResultKind, type TypedDay } from "../domain/result-type.js";
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
    const google = campaigns.filter((campaign) => campaign.channel === "GOOGLE").map((campaign) => campaign.id);
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
