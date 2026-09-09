import { shiftDays, todayIso } from "@/shared/lib/index.js";
import type { DateRange } from "@/entities/campaign/index.js";

export const SHORTCUTS = ["7d", "month", "prevMonth"] as const;

export type Shortcut = (typeof SHORTCUTS)[number];

const firstOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;

export function shortcutRange(shortcut: Shortcut, today = todayIso()): DateRange {
  switch (shortcut) {
    case "7d":
      return { from: shiftDays(today, -6), to: today };
    case "month":
      return { from: firstOfMonth(today), to: today };
    case "prevMonth": {
      const lastDay = shiftDays(firstOfMonth(today), -1);
      return { from: firstOfMonth(lastDay), to: lastDay };
    }
  }
}

export function defaultRange(today = todayIso()): DateRange {
  return { from: shiftDays(today, -29), to: today };
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isDateRange(range: DateRange): boolean {
  return isIsoDate(range.from) && isIsoDate(range.to) && range.from <= range.to;
}
