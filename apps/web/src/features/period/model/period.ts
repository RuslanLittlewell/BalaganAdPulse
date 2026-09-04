import { shiftDays, todayIso } from "@/shared/lib/index.js";
import type { DateRange } from "@/entities/campaign/index.js";
import { t } from "@/shared/config/index.js";

export const PERIODS = ["7d", "30d", "90d", "month", "prevMonth"] as const;

export type Period = (typeof PERIODS)[number];

export const DEFAULT_PERIOD: Period = "30d";

export function isPeriod(value: string | null): value is Period {
  return value !== null && (PERIODS as readonly string[]).includes(value);
}

const firstOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;

export function rangeOf(period: Period, today = todayIso()): DateRange {
  switch (period) {
    case "7d":
      return { from: shiftDays(today, -6), to: today };
    case "30d":
      return { from: shiftDays(today, -29), to: today };
    case "90d":
      return { from: shiftDays(today, -89), to: today };
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
