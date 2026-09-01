import { shiftDays, todayIso } from "@/shared/lib/index.js";
import type { DateRange } from "@/entities/campaign/index.js";
import { t } from "@/shared/config/index.js";

/** The periods a media buyer actually asks for. Wider than a week, narrower
 * than a year: the figures are read to decide what to do this week. */
export const PERIODS = ["7d", "30d", "90d", "month", "prevMonth"] as const;

export type Period = (typeof PERIODS)[number];

export const DEFAULT_PERIOD: Period = "30d";

export function isPeriod(value: string | null): value is Period {
  return value !== null && (PERIODS as readonly string[]).includes(value);
}

/** The first day of the month `iso` falls in. */
const firstOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;

/**
 * The days a period covers, both ends included.
 *
 * `today` is a parameter rather than the clock so the function stays pure: the
 * caller decides which day "today" is, and a test can name one.
 */
export function rangeOf(period: Period, today = todayIso()): DateRange {
  switch (period) {
    case "7d":
      return { from: shiftDays(today, -6), to: today };
    case "30d":
      return { from: shiftDays(today, -29), to: today };
    case "90d":
      return { from: shiftDays(today, -89), to: today };
    // The month *so far*: the days still to come have no figures, and counting
    // them makes every period look worse than it is until the month ends.
    case "month":
      return { from: firstOfMonth(today), to: today };
    case "prevMonth": {
      const lastDay = shiftDays(firstOfMonth(today), -1);
      return { from: firstOfMonth(lastDay), to: lastDay };
    }
  }
}

export function periodLabel(period: Period): string {
  return t(`period.${period}`);
}
