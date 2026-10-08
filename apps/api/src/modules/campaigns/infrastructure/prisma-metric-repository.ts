import type { Prisma, PrismaClient } from "@prisma/client";
import type { MeasuredDay } from "../domain/metrics.js";
import type { MetricRepository } from "../application/metric-ports.js";

interface StoredRow {
  date: Date;
  spend: Prisma.Decimal;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  revenue: Prisma.Decimal;
}

const toMeasured = (row: StoredRow): MeasuredDay => ({
  date: row.date,
  spend: row.spend.toNumber(),
  impressions: row.impressions,
  reach: row.reach,
  clicks: row.clicks,
  conversions: row.conversions,
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

  async readAdSetRange(adSetId: string, from: Date, to: Date): Promise<MeasuredDay[]> {
    const rows = await this.prisma.adSetDailyMetric.findMany({
      where: { adSetId, date: within(from, to) },
      orderBy: { date: "asc" },
    });
    return rows.map(toMeasured);
  }

  async readAdRange(adId: string, from: Date, to: Date): Promise<MeasuredDay[]> {
    const rows = await this.prisma.adDailyMetric.findMany({
      where: { adId, date: within(from, to) },
      orderBy: { date: "asc" },
    });
    return rows.map(toMeasured);
  }
}
