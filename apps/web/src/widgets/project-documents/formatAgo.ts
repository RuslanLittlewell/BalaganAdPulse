const AGO = new Intl.RelativeTimeFormat("ru", { numeric: "auto" });

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function formatAgo(iso: string, now = Date.now()): string {
  const elapsed = Math.max(0, now - new Date(iso).getTime());
  if (elapsed < MINUTE) return AGO.format(0, "second");
  if (elapsed < HOUR) return AGO.format(-Math.floor(elapsed / MINUTE), "minute");
  if (elapsed < DAY) return AGO.format(-Math.floor(elapsed / HOUR), "hour");
  if (elapsed <= WEEK) return AGO.format(-Math.floor(elapsed / DAY), "day");
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
