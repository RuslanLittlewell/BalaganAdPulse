import { costPerLead, relativeChange } from "./money.js";
import { addMonths, monthsBetween, type Month } from "./month.js";

export const REPORT_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

const SUGGESTED_ADS = 3;
export const MAX_CHOSEN_ADS = 6;
const TREND_MONTHS = 6;
export const AVAILABLE_MONTHS = 12;

export interface MonthTotals {
  readonly month: Month;
  readonly spend: string;
  readonly leads: number;
}

export interface AdTotals {
  readonly adId: string;
  readonly name: string;
  readonly spend: string;
  readonly leads: number;
}

export interface ReportFigures {
  readonly spend: string;
  readonly leads: number;
  readonly history: readonly MonthTotals[];
  readonly ads: readonly AdTotals[];
}

export interface ReportRecord {
  readonly id: string;
  readonly projectId: string;
  readonly month: Month;
  readonly status: ReportStatus;
  readonly currency: string | null;
  readonly figures: ReportFigures;
  readonly computedAt: Date;
  readonly leadsOverride: number | null;
  readonly messengerContacts: number | null;
  readonly conclusions: unknown;
  readonly plan: unknown;
  readonly adIds: readonly string[];
  readonly publishedAt: Date | null;
  readonly coverKey: string | null;
  readonly coverContentType: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface FigureSources {
  readonly month: Month;
  readonly firstMonth: Month | null;
  readonly totals: readonly MonthTotals[];
  readonly corrections: ReadonlyMap<Month, number>;
  readonly ads: readonly AdTotals[];
}

export function trendStart(month: Month): Month {
  return addMonths(month, 1 - TREND_MONTHS);
}

export function computeFigures(sources: FigureSources): ReportFigures {
  const byMonth = new Map(sources.totals.map((totals) => [totals.month, totals]));
  const current = byMonth.get(sources.month);
  const start = sources.firstMonth && sources.firstMonth > trendStart(sources.month)
    ? sources.firstMonth
    : trendStart(sources.month);
  const history = sources.firstMonth === null || start >= sources.month
    ? []
    : monthsBetween(start, addMonths(sources.month, -1)).map((month) => ({
      month,
      spend: byMonth.get(month)?.spend ?? "0.0000",
      leads: sources.corrections.get(month) ?? byMonth.get(month)?.leads ?? 0,
    }));
  return {
    spend: current?.spend ?? "0.0000",
    leads: current?.leads ?? 0,
    history,
    ads: sources.ads,
  };
}

export function suggestAds(ads: readonly AdTotals[]): string[] {
  return ads
    .filter((ad) => ad.leads > 0)
    .sort((a, b) => b.leads - a.leads || Number(a.spend) - Number(b.spend) || a.adId.localeCompare(b.adId))
    .slice(0, SUGGESTED_ADS)
    .map((ad) => ad.adId);
}

export function keepRunningAds(adIds: readonly string[], figures: ReportFigures): string[] {
  const running = new Set(figures.ads.map((ad) => ad.adId));
  return adIds.filter((id) => running.has(id));
}

export function effectiveLeads(report: Pick<ReportRecord, "figures" | "leadsOverride">): number {
  return report.leadsOverride ?? report.figures.leads;
}

const withCost = (totals: MonthTotals) => ({ ...totals, costPerLead: costPerLead(totals.spend, totals.leads) });

export function describeFigures(report: ReportRecord) {
  const current = withCost({ month: report.month, spend: report.figures.spend, leads: effectiveLeads(report) });
  const previousEntry = report.figures.history.find((entry) => entry.month === addMonths(report.month, -1));
  const previous = previousEntry ? withCost(previousEntry) : null;
  const ads = new Map(report.figures.ads.map((ad) => [ad.adId, ad]));
  return {
    spend: current.spend,
    leads: current.leads,
    costPerLead: current.costPerLead,
    previous,
    change: {
      leads: previous ? relativeChange(String(current.leads), String(previous.leads)) : null,
      costPerLead: previous?.costPerLead && current.costPerLead
        ? relativeChange(current.costPerLead, previous.costPerLead)
        : null,
    },
    trend: [...report.figures.history.map(withCost), current],
    ads: report.adIds.flatMap((id) => {
      const ad = ads.get(id);
      return ad ? [{ ...ad, costPerLead: costPerLead(ad.spend, ad.leads) }] : [];
    }),
    runningAds: report.figures.ads.map((ad) => ({ ...ad, costPerLead: costPerLead(ad.spend, ad.leads) })),
  };
}
