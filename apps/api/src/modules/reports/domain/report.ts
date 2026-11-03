import { costPerLead, relativeChange } from "./money.js";
import { addMonths, monthsBetween, type Month } from "./month.js";

export const REPORT_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

const SUGGESTED_ADS = 3;
export const MAX_CHOSEN_ADS = 6;
const TREND_MONTHS = 6;
export const AVAILABLE_MONTHS = 12;
export const ENTERED_MONTHS = TREND_MONTHS - 1;
const DEFAULT_CONTACTS = "MESSAGES";

export interface MonthTotals {
  readonly month: Month;
  readonly spend: string;
  readonly leads: number;
}

export interface HistoryMonth {
  readonly month: Month;
  readonly spend: string | null;
  readonly leads: number;
}

export interface EnteredMonth {
  readonly leads: number;
  readonly spend: string | null;
}

export interface ResultTotal {
  readonly type: string;
  readonly results: number;
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
  readonly history: readonly HistoryMonth[];
  readonly ads: readonly AdTotals[];
  readonly results?: readonly ResultTotal[];
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
  readonly contactsSource: string | null;
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
  readonly entries: ReadonlyMap<Month, EnteredMonth>;
  readonly ads: readonly AdTotals[];
  readonly results: readonly ResultTotal[];
}

export function trendStart(month: Month): Month {
  return addMonths(month, 1 - TREND_MONTHS);
}

export function enteredWindow(month: Month): Month[] {
  return monthsBetween(trendStart(month), addMonths(month, -1));
}

export function computeHistory(sources: Omit<FigureSources, "ads" | "results">): HistoryMonth[] {
  const byMonth = new Map(sources.totals.map((totals) => [totals.month, totals]));
  const window = new Set(enteredWindow(sources.month));
  const firstEntered = [...sources.entries.keys()].filter((month) => window.has(month)).sort()[0] ?? null;
  const earliest = [sources.firstMonth, firstEntered].filter((month): month is Month => month !== null).sort()[0] ?? null;
  if (earliest === null) return [];
  const start = earliest > trendStart(sources.month) ? earliest : trendStart(sources.month);
  if (start >= sources.month) return [];
  const synced = (month: Month) => sources.firstMonth !== null && month >= sources.firstMonth;
  return monthsBetween(start, addMonths(sources.month, -1)).map((month) => {
    const entry = window.has(month) ? sources.entries.get(month) : undefined;
    return {
      month,
      spend: entry?.spend ?? byMonth.get(month)?.spend ?? (synced(month) ? "0.0000" : null),
      leads: entry?.leads ?? sources.corrections.get(month) ?? byMonth.get(month)?.leads ?? 0,
    };
  });
}

export function computeFigures(sources: FigureSources): ReportFigures {
  const current = sources.totals.find((totals) => totals.month === sources.month);
  return {
    spend: current?.spend ?? "0.0000",
    leads: current?.leads ?? 0,
    history: computeHistory(sources),
    ads: sources.ads,
    results: sources.results.filter((total) => total.results > 0),
  };
}

export function resultsOf(figures: ReportFigures): readonly ResultTotal[] {
  return figures.results ?? [];
}

export function holdsResults(figures: ReportFigures, type: string): boolean {
  return resultsOf(figures).some((total) => total.type === type && total.results > 0);
}

export function defaultContactsSource(figures: ReportFigures): string | null {
  return holdsResults(figures, DEFAULT_CONTACTS) ? DEFAULT_CONTACTS : null;
}

export function contactsOf(report: Pick<ReportRecord, "figures" | "contactsSource" | "messengerContacts">): number | null {
  if (report.contactsSource === null) return report.messengerContacts;
  return resultsOf(report.figures).find((total) => total.type === report.contactsSource)?.results ?? 0;
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

const withCost = <T extends HistoryMonth>(totals: T) => ({
  ...totals,
  costPerLead: totals.spend === null ? null : costPerLead(totals.spend, totals.leads),
});

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
