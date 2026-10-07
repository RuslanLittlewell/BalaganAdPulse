export type Month = string;

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonth(value: string): value is Month {
  return MONTH.test(value);
}

export function addMonths(month: Month, count: number): Month {
  const [year, index] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year!, index! - 1 + count, 1));
  return monthOf(shifted);
}

export function monthOf(date: Date): Month {
  return date.toISOString().slice(0, 7);
}

export function firstDay(month: Month): Date {
  return new Date(`${month}-01T00:00:00.000Z`);
}

export function lastDay(month: Month): Date {
  return new Date(firstDay(addMonths(month, 1)).getTime() - 86_400_000);
}

export function monthsBetween(from: Month, to: Month): Month[] {
  const months: Month[] = [];
  for (let month = from; month <= to; month = addMonths(month, 1)) months.push(month);
  return months;
}

function localDate(now: Date, timezone: string): string {
  const format = (zone: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  try {
    return format(timezone);
  } catch {
    return format("UTC");
  }
}

export function hasEnded(month: Month, timezones: readonly string[], now: Date): boolean {
  const nextStart = `${addMonths(month, 1)}-01`;
  const zones = timezones.length > 0 ? timezones : ["UTC"];
  return zones.every((zone) => localDate(now, zone) >= nextStart);
}

export function latestEnded(timezones: readonly string[], now: Date): Month {
  const previous = addMonths(monthOf(now), -1);
  return hasEnded(previous, timezones, now) ? previous : addMonths(previous, -1);
}

export function recentEnded(timezones: readonly string[], now: Date, count: number): Month[] {
  const latest = latestEnded(timezones, now);
  return Array.from({ length: count }, (_, index) => addMonths(latest, -index));
}
