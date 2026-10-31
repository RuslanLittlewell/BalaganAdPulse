export const SUMMARY_PERIODS = ["y", "7d", "m", "pm"] as const;

export type SummaryPeriod = (typeof SUMMARY_PERIODS)[number];

export const DEFAULT_PERIOD: SummaryPeriod = "m";

export const PROJECTS_PER_PAGE = 8;

export const MAX_LAGGING = 10;

export const isSummaryPeriod = (value: string): value is SummaryPeriod =>
  (SUMMARY_PERIODS as readonly string[]).includes(value);

export interface DayRange {
  readonly from: string;
  readonly to: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function shiftDay(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

const firstOfMonth = (date: string) => `${date.slice(0, 7)}-01`;

export function periodRange(period: SummaryPeriod, today: string): DayRange {
  switch (period) {
    case "y": {
      const yesterday = shiftDay(today, -1);
      return { from: yesterday, to: yesterday };
    }
    case "7d":
      return { from: shiftDay(today, -6), to: today };
    case "m":
      return { from: firstOfMonth(today), to: today };
    case "pm": {
      const lastDay = shiftDay(firstOfMonth(today), -1);
      return { from: firstOfMonth(lastDay), to: lastDay };
    }
  }
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PROJECTS_PER_PAGE));
}

export function clampPage(page: number, total: number): number {
  return Math.min(Math.max(0, page), pageCount(total) - 1);
}
