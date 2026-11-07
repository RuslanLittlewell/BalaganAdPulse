export const HISTORY_DAYS = 486;
export const REFRESH_DAYS = 10;
export const TOP_DAYS = 90;
export const TOP_PER_DAY = 1000;
export const IMPRESSION_DAYS = 28;

export type TopKind = "query" | "page";

export interface SearchDay {
  readonly date: string;
  readonly clicks: number;
  readonly impressions: number;
  readonly position: number;
}

export interface TopRow {
  readonly date: string;
  readonly key: string;
  readonly clicks: number;
  readonly impressions: number;
  readonly position: number;
}

export interface SearchSnapshot {
  readonly from: string;
  readonly to: string;
  readonly topFrom: string;
  readonly days: readonly SearchDay[];
  readonly queries: readonly TopRow[];
  readonly pages: readonly TopRow[];
}

export interface SearchTotals {
  readonly clicks: number;
  readonly impressions: number;
  readonly ctr: number | null;
  readonly position: number | null;
}

export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function importWindow(today: string, firstImport: boolean): { from: string; to: string; topFrom: string } {
  const to = shiftDate(today, -1);
  const from = shiftDate(to, -(firstImport ? HISTORY_DAYS : REFRESH_DAYS - 1));
  const earliestTop = shiftDate(to, -(TOP_DAYS - 1));
  return { from, to, topFrom: from > earliestTop ? from : earliestTop };
}

export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const length = daysBetween(from, to) + 1;
  return { from: shiftDate(from, -length), to: shiftDate(from, -1) };
}

export function totalsOf(rows: readonly { clicks: number; impressions: number; position: number }[]): SearchTotals {
  let clicks = 0;
  let impressions = 0;
  let weighted = 0;
  for (const row of rows) {
    clicks += row.clicks;
    impressions += row.impressions;
    weighted += row.position * row.impressions;
  }
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : null,
    position: impressions > 0 ? weighted / impressions : null,
  };
}
