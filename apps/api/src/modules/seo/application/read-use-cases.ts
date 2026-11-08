import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import { isProblemKind, PROBLEM_KINDS, severityOf, type ProblemKind } from "../domain/page-audit.js";
import { previousPeriod, totalsOf, type SearchDay, type SearchTotals, type TopKind } from "../domain/search.js";
import { shareOf, SOURCES_SHOWN } from "../domain/traffic.js";
import { DEVICES, METRICS, passes, rate, rateScore } from "../domain/vitals.js";
import type { SeoDependencies, SeoReads, StoredAuditPage } from "./ports.js";
import { readableSite } from "./site-use-cases.js";

export interface DateRange {
  readonly from: string;
  readonly to: string;
}

const round = (value: number | null, digits: number) => (value === null ? null : Number(value.toFixed(digits)));

function shownTotals(totals: SearchTotals) {
  return { clicks: totals.clicks, impressions: totals.impressions, ctr: round(totals.ctr, 4), position: round(totals.position, 2) };
}

function shownDay(day: SearchDay) {
  return { ...shownTotals(totalsOf([day])), date: day.date };
}

function kindsOf(problems: readonly string[]): ProblemKind[] {
  return problems.filter(isProblemKind).sort((a, b) => PROBLEM_KINDS.indexOf(a) - PROBLEM_KINDS.indexOf(b));
}

function listedPage(page: StoredAuditPage) {
  return { id: page.id, url: page.url, status: page.status, outcome: page.outcome, problems: kindsOf(page.problems).map((kind) => ({ kind, severity: severityOf(kind) })) };
}

export function createReadUseCases(d: Pick<SeoDependencies, "sites" | "projects"> & { reads: SeoReads; vitalsConfigured: boolean }) {
  return {
    search: async (actor: ActorContext, projectId: string, siteId: string, range: DateRange) => {
      await readableSite(d, actor, projectId, siteId);
      const before = previousPeriod(range.from, range.to);
      const [days, previous, latestDay] = await Promise.all([
        d.reads.days(siteId, range.from, range.to),
        d.reads.days(siteId, before.from, before.to),
        d.reads.latestDay(siteId),
      ]);
      return {
        from: range.from,
        to: range.to,
        latestDay,
        totals: shownTotals(totalsOf(days)),
        previous: shownTotals(totalsOf(previous)),
        days: days.map(shownDay),
      };
    },

    top: async (actor: ActorContext, projectId: string, siteId: string, kind: TopKind, range: DateRange, limit: number) => {
      await readableSite(d, actor, projectId, siteId);
      const earliest = await d.reads.earliestTopDay(siteId, kind);
      const partial = earliest !== null && earliest > range.from;
      const from = partial ? earliest : range.from;
      const [items, days] = await Promise.all([
        d.reads.top(siteId, kind, from, range.to, limit),
        d.reads.days(siteId, from, range.to),
      ]);
      const totalClicks = totalsOf(days).clicks;
      return {
        kind,
        from,
        to: range.to,
        partial,
        totalClicks,
        items: items.map((item) => ({
          key: item.key,
          clicks: item.clicks,
          impressions: item.impressions,
          ctr: round(item.impressions > 0 ? item.clicks / item.impressions : null, 4),
          position: round(item.position, 2),
          share: round(totalClicks > 0 ? item.clicks / totalClicks : 0, 4),
        })),
      };
    },

    vitals: async (actor: ActorContext, projectId: string, siteId: string, range: DateRange) => {
      const site = await readableSite(d, actor, projectId, siteId);
      const [readings, weeks, labs] = await Promise.all([
        d.reads.vitals(siteId),
        d.reads.weeks(siteId, range.from, range.to),
        d.reads.labs(siteId),
      ]);
      return {
        configured: d.vitalsConfigured,
        readAt: site.vitalsReadAt,
        devices: DEVICES.map((device) => {
          const own = readings.filter((reading) => reading.device === device);
          const lab = labs.find((measurement) => measurement.device === device);
          return {
            device,
            periodEnd: own[0]?.periodEnd ?? null,
            passes: passes(own),
            metrics: METRICS.flatMap((metric) => {
              const reading = own.find((candidate) => candidate.metric === metric);
              if (!reading) return [];
              return [{
                metric,
                p75: reading.p75,
                rating: rate(metric, reading.p75),
                good: reading.good,
                needsImprovement: reading.needsImprovement,
                poor: reading.poor,
                weeks: weeks
                  .filter((week) => week.device === device && week.metric === metric)
                  .map((week) => ({ periodEnd: week.periodEnd, p75: week.p75 })),
              }];
            }),
            lab: lab ? { ...lab, rating: rateScore(lab.score) } : null,
          };
        }),
      };
    },

    traffic: async (actor: ActorContext, projectId: string, siteId: string, range: DateRange) => {
      const site = await readableSite(d, actor, projectId, siteId);
      if (site.analyticsPropertyId === null) return { connected: false as const };
      const before = previousPeriod(range.from, range.to);
      const [channels, earlier, sources, days] = await Promise.all([
        d.reads.trafficChannels(siteId, range.from, range.to),
        d.reads.trafficChannels(siteId, before.from, before.to),
        d.reads.trafficSources(siteId, range.from, range.to, SOURCES_SHOWN),
        d.reads.trafficDays(siteId, range.from, range.to),
      ]);
      const total = channels.reduce((sum, channel) => sum + channel.sessions, 0);
      const previousTotal = earlier.reduce((sum, channel) => sum + channel.sessions, 0);
      const names = [...new Set([...channels, ...earlier].map((channel) => channel.channel))];
      const sessionsOf = (rows: readonly { channel: string; sessions: number }[], name: string) => rows.find((row) => row.channel === name)?.sessions ?? 0;
      return {
        connected: true as const,
        propertyName: site.analyticsName ?? site.analyticsPropertyId,
        status: site.trafficStatus,
        lastSuccessAt: site.trafficSuccessAt,
        lastError: site.trafficError,
        from: range.from,
        to: range.to,
        totalSessions: total,
        previousSessions: previousTotal,
        channels: names
          .map((channel) => ({ channel, sessions: sessionsOf(channels, channel), share: shareOf(sessionsOf(channels, channel), total), previous: sessionsOf(earlier, channel) }))
          .sort((a, b) => b.sessions - a.sessions || b.previous - a.previous || a.channel.localeCompare(b.channel)),
        sources: sources.map((source) => ({ ...source, share: shareOf(source.sessions, total) })),
        days,
      };
    },

    audit: async (actor: ActorContext, projectId: string, siteId: string) => {
      const site = await readableSite(d, actor, projectId, siteId);
      const stored = await d.reads.audit(siteId);
      const result = stored && (() => {
        const counts = new Map<ProblemKind, number>();
        let pagesWithErrors = 0;
        let pagesWithWarnings = 0;
        for (const problems of stored.problems) {
          const kinds = kindsOf(problems);
          if (kinds.some((kind) => severityOf(kind) === "ERROR")) pagesWithErrors++;
          if (kinds.some((kind) => severityOf(kind) === "WARNING")) pagesWithWarnings++;
          for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1);
        }
        const kinds = [...counts]
          .map(([kind, pages]) => ({ kind, severity: severityOf(kind), pages }))
          .sort((a, b) => (a.severity === b.severity ? b.pages - a.pages || PROBLEM_KINDS.indexOf(a.kind) - PROBLEM_KINDS.indexOf(b.kind) : a.severity === "ERROR" ? -1 : 1));
        return { finishedAt: stored.finishedAt, checked: stored.checked, notChecked: stored.notChecked, pagesWithErrors, pagesWithWarnings, kinds };
      })();
      return { status: site.checkStatus, lastCheckAt: site.lastCheckAt, checkError: site.checkError, result };
    },

    auditPages: async (actor: ActorContext, projectId: string, siteId: string, kind: ProblemKind | null) => {
      await readableSite(d, actor, projectId, siteId);
      return (await d.reads.auditPages(siteId, kind)).map(listedPage);
    },

    auditPage: async (actor: ActorContext, projectId: string, siteId: string, pageId: string, range: DateRange) => {
      await readableSite(d, actor, projectId, siteId);
      const page = await d.reads.auditPage(siteId, pageId);
      if (!page) throw new AppError("not-found", "Page not found");
      const [figures] = await d.reads.top(siteId, "page", range.from, range.to, 1, [page.url]);
      return {
        ...listedPage(page),
        finalUrl: page.finalUrl,
        contentType: page.contentType,
        responseMs: page.responseMs,
        inSitemap: page.inSitemap,
        hasImpressions: page.hasImpressions,
        facts: page.facts,
        search: figures
          ? { clicks: figures.clicks, impressions: figures.impressions, position: round(figures.position, 2) }
          : null,
      };
    },
  };
}
