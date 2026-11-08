import { Prisma, type PrismaClient } from "@prisma/client";
import type { SeoReads, StoredAudit, StoredAuditPage, StoredLab, TopTotal } from "../application/ports.js";
import type { PageFacts } from "../domain/page-audit.js";
import type { SearchDay, TopKind } from "../domain/search.js";
import type { ChannelTotal, DayTotal, SourceTotal } from "../domain/traffic.js";
import type { Device, Metric, VitalReading, VitalWeek } from "../domain/vitals.js";

const day = (date: string) => new Date(`${date}T00:00:00Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

type AuditPageRow = Prisma.SeoAuditPageGetPayload<object>;

function storedPage(row: AuditPageRow): StoredAuditPage {
  const { outcome, ...facts } = (row.facts ?? {}) as Record<string, unknown>;
  const hasFacts = "title" in facts;
  return {
    id: row.id,
    url: row.url,
    status: row.status,
    finalUrl: row.finalUrl,
    contentType: row.contentType,
    responseMs: row.responseMs,
    inSitemap: row.inSitemap,
    hasImpressions: row.hasImpressions,
    outcome: typeof outcome === "string" ? outcome : "FETCHED",
    facts: hasFacts ? (facts as unknown as PageFacts) : null,
    problems: row.problems,
  };
}

const TOP_SOURCES: Record<TopKind, { table: Prisma.Sql; column: Prisma.Sql }> = {
  query: { table: Prisma.raw('"seo_query_day"'), column: Prisma.raw('"query"') },
  page: { table: Prisma.raw('"seo_page_day"'), column: Prisma.raw('"page"') },
};

export class PrismaSeoReads implements SeoReads {
  constructor(private readonly prisma: PrismaClient) {}

  async trafficChannels(siteId: string, from: string, to: string): Promise<ChannelTotal[]> {
    const rows = await this.prisma.seoTrafficDay.groupBy({
      by: ["channel"],
      where: { siteId, date: { gte: day(from), lte: day(to) } },
      _sum: { sessions: true },
      orderBy: { _sum: { sessions: "desc" } },
    });
    return rows.map((row) => ({ channel: row.channel, sessions: row._sum.sessions ?? 0 }));
  }

  async trafficSources(siteId: string, from: string, to: string, limit: number): Promise<SourceTotal[]> {
    const rows = await this.prisma.seoTrafficDay.groupBy({
      by: ["source", "medium"],
      where: { siteId, date: { gte: day(from), lte: day(to) } },
      _sum: { sessions: true },
      orderBy: [{ _sum: { sessions: "desc" } }, { source: "asc" }, { medium: "asc" }],
      take: limit,
    });
    return rows.map((row) => ({ source: row.source, medium: row.medium, sessions: row._sum.sessions ?? 0 }));
  }

  async trafficDays(siteId: string, from: string, to: string): Promise<DayTotal[]> {
    const rows = await this.prisma.seoTrafficDay.groupBy({
      by: ["date"],
      where: { siteId, date: { gte: day(from), lte: day(to) } },
      _sum: { sessions: true },
      orderBy: { date: "asc" },
    });
    return rows.map((row) => ({ date: iso(row.date), sessions: row._sum.sessions ?? 0 }));
  }

  async days(siteId: string, from: string, to: string): Promise<SearchDay[]> {
    const rows = await this.prisma.seoDay.findMany({ where: { siteId, date: { gte: day(from), lte: day(to) } }, orderBy: { date: "asc" } });
    return rows.map((row) => ({ date: iso(row.date), clicks: row.clicks, impressions: row.impressions, position: Number(row.position) }));
  }

  async latestDay(siteId: string): Promise<string | null> {
    const row = await this.prisma.seoDay.findFirst({ where: { siteId }, orderBy: { date: "desc" }, select: { date: true } });
    return row ? iso(row.date) : null;
  }

  async earliestTopDay(siteId: string, kind: TopKind): Promise<string | null> {
    const found = kind === "query"
      ? await this.prisma.seoQueryDay.aggregate({ where: { siteId }, _min: { date: true } })
      : await this.prisma.seoPageDay.aggregate({ where: { siteId }, _min: { date: true } });
    return found._min.date ? iso(found._min.date) : null;
  }

  async top(siteId: string, kind: TopKind, from: string, to: string, limit: number, keys?: readonly string[]): Promise<TopTotal[]> {
    const { table, column } = TOP_SOURCES[kind];
    const only = keys ? Prisma.sql`AND ${column} IN (${Prisma.join(keys.length > 0 ? keys : [""])})` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<{ key: string; clicks: bigint; impressions: bigint; weighted: Prisma.Decimal | null }[]>`
      SELECT ${column} AS key, SUM(clicks)::bigint AS clicks, SUM(impressions)::bigint AS impressions, SUM(position * impressions) AS weighted
      FROM ${table}
      WHERE site_id = ${siteId} AND date >= ${from}::date AND date <= ${to}::date ${only}
      GROUP BY ${column}
      ORDER BY SUM(clicks) DESC, SUM(impressions) DESC, ${column} ASC
      LIMIT ${limit}`;
    return rows.map((row) => {
      const impressions = Number(row.impressions);
      return {
        key: row.key,
        clicks: Number(row.clicks),
        impressions,
        position: impressions > 0 && row.weighted !== null ? Number(row.weighted) / impressions : 0,
      };
    });
  }

  async vitals(siteId: string): Promise<VitalReading[]> {
    const rows = await this.prisma.seoVital.findMany({ where: { siteId } });
    return rows.map((row) => ({
      device: row.device as Device,
      metric: row.metric as Metric,
      periodEnd: iso(row.periodEnd),
      p75: Number(row.p75),
      good: Number(row.good),
      needsImprovement: Number(row.needsImprovement),
      poor: Number(row.poor),
    }));
  }

  async weeks(siteId: string, from: string, to: string): Promise<VitalWeek[]> {
    const rows = await this.prisma.seoVitalWeek.findMany({
      where: { siteId, periodEnd: { gte: day(from), lte: day(to) } },
      orderBy: { periodEnd: "asc" },
    });
    return rows.map((row) => ({ device: row.device as Device, metric: row.metric as Metric, periodEnd: iso(row.periodEnd), p75: Number(row.p75) }));
  }

  async labs(siteId: string): Promise<StoredLab[]> {
    const rows = await this.prisma.seoLab.findMany({ where: { siteId } });
    return rows.map((row) => ({ ...row, device: row.device as Device, cls: Number(row.cls) }));
  }

  async audit(siteId: string): Promise<StoredAudit | null> {
    const audit = await this.prisma.seoAudit.findUnique({
      where: { siteId },
      include: { pages: { select: { problems: true } } },
    });
    if (!audit) return null;
    return { finishedAt: audit.finishedAt, checked: audit.checked, notChecked: audit.notChecked, problems: audit.pages.map((page) => page.problems) };
  }

  async auditPages(siteId: string, kind: string | null): Promise<StoredAuditPage[]> {
    const rows = await this.prisma.seoAuditPage.findMany({
      where: { audit: { siteId }, ...(kind ? { problems: { has: kind } } : {}) },
      orderBy: { url: "asc" },
    });
    return rows.map(storedPage);
  }

  async auditPage(siteId: string, pageId: string): Promise<StoredAuditPage | null> {
    const row = await this.prisma.seoAuditPage.findFirst({ where: { id: pageId, audit: { siteId } } });
    return row ? storedPage(row) : null;
  }
}
