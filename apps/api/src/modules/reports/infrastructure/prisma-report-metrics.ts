import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { ReportMetrics } from "../application/ports.js";
import { addMonths, firstDay, monthOf, type Month } from "../domain/month.js";

const amount = (value: Prisma.Decimal | null) => (value ?? new Prisma.Decimal(0)).toFixed(4);

export class PrismaReportMetrics implements ReportMetrics {
  constructor(private readonly prisma: PrismaClient) {}

  async timezones(projectId: string) {
    const rows = await this.prisma.projectIntegration.findMany({ where: { projectId }, select: { timezone: true } });
    return [...new Set(rows.map((row) => row.timezone))];
  }

  async firstMonth(projectId: string) {
    const found = await this.prisma.campaignDailyMetric.findFirst({
      where: { campaign: { projectId } }, orderBy: { date: "asc" }, select: { date: true },
    });
    return found ? monthOf(found.date) : null;
  }

  async monthTotals(projectId: string, from: Month, to: Month) {
    const rows = await this.prisma.$queryRaw<Array<{ month: Date; spend: Prisma.Decimal | null; leads: bigint | null }>>`
      SELECT date_trunc('month', m.date)::date AS month, SUM(m.spend) AS spend, SUM(m.conversions) AS leads
      FROM campaign_daily_metric m
      JOIN campaign c ON c.id = m.campaign_id
      WHERE c.project_id = ${projectId}
        AND m.date >= ${firstDay(from)} AND m.date < ${firstDay(addMonths(to, 1))}
      GROUP BY 1
      ORDER BY 1`;
    return rows.map((row) => ({ month: monthOf(row.month), spend: amount(row.spend), leads: Number(row.leads ?? 0) }));
  }

  async adTotals(projectId: string, month: Month) {
    const rows = await this.prisma.$queryRaw<Array<{ ad_id: string; name: string; spend: Prisma.Decimal | null; leads: bigint | null }>>`
      SELECT a.id AS ad_id, a.name, SUM(m.spend) AS spend, SUM(m.conversions) AS leads
      FROM ad_daily_metric m
      JOIN ad a ON a.id = m.ad_id
      JOIN ad_set s ON s.id = a.ad_set_id
      JOIN campaign c ON c.id = s.campaign_id
      WHERE c.project_id = ${projectId}
        AND m.date >= ${firstDay(month)} AND m.date < ${firstDay(addMonths(month, 1))}
      GROUP BY a.id, a.name
      HAVING SUM(m.spend) > 0
      ORDER BY a.name, a.id`;
    return rows.map((row) => ({ adId: row.ad_id, name: row.name, spend: amount(row.spend), leads: Number(row.leads ?? 0) }));
  }
}
