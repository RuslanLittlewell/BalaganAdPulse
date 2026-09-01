import type { Prisma, PrismaClient } from "@prisma/client";
import type { Measured, MeasuredDay } from "../domain/metrics.js";
import type { MetricRepository } from "../application/metric-ports.js";

/** The columns every level stores, identically. */
interface StoredRow {
  date: Date;
  spend: Prisma.Decimal;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  revenue: Prisma.Decimal;
}

/**
 * Decimal to number at the boundary.
 *
 * Money is stored as `DECIMAL(18,4)` so no rounding happens on the way in, and
 * converted here because the domain sums and divides in plain numbers. The
 * magnitudes are advertising spend at four decimal places — far inside what a
 * double represents exactly — so the conversion is lossless in practice, and
 * keeping the domain free of a decimal library is worth more than the margin.
 */
const toMeasured = (row: StoredRow): MeasuredDay => ({
  date: row.date,
  spend: row.spend.toNumber(),
  impressions: row.impressions,
  reach: row.reach,
  clicks: row.clicks,
  conversions: row.conversions,
  revenue: row.revenue.toNumber(),
});

const figures = (measured: Measured) => ({
  spend: measured.spend,
  impressions: measured.impressions,
  reach: measured.reach,
  clicks: measured.clicks,
  conversions: measured.conversions,
  revenue: measured.revenue,
});

/** Both endpoints included: a range named by two dates means those two days. */
const within = (from: Date, to: Date) => ({ gte: from, lte: to });

export class PrismaMetricRepository implements MetricRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Upsert, not create: platforms restate a day's figures as attribution
   * settles, so the same date arrives repeatedly. The (entity, date) primary
   * key makes the replacement the database's job rather than a read-then-write
   * that two concurrent syncs could interleave.
   */
  async recordCampaignDay(campaignId: string, date: Date, measured: Measured): Promise<void> {
    const values = figures(measured);
    await this.prisma.campaignDailyMetric.upsert({
      where: { campaignId_date: { campaignId, date } },
      create: { campaignId, date, ...values },
      update: { ...values, syncedAt: new Date() },
    });
  }

  async recordAdSetDay(adSetId: string, date: Date, measured: Measured): Promise<void> {
    const values = figures(measured);
    await this.prisma.adSetDailyMetric.upsert({
      where: { adSetId_date: { adSetId, date } },
      create: { adSetId, date, ...values },
      update: { ...values, syncedAt: new Date() },
    });
  }

  async recordAdDay(adId: string, date: Date, measured: Measured): Promise<void> {
    const values = figures(measured);
    await this.prisma.adDailyMetric.upsert({
      where: { adId_date: { adId, date } },
      create: { adId, date, ...values },
      update: { ...values, syncedAt: new Date() },
    });
  }

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
