import { shiftDays, todayIso } from "@/shared/lib/index.js";
import type { DateRange } from "@/entities/campaign/index.js";

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
