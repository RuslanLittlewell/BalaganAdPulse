/** "2026-08-01" -> "01 авг.". Parsed as UTC so the local zone cannot shift the day. */
export function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

/** `iso` moved by whole days. UTC arithmetic, so no daylight-saving shift moves the day. */
export function shiftDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "2026-08-31" -> "2026-09-01". */
export function nextDay(iso: string): string {
  return shiftDays(iso, 1);
}

/** The viewer's own calendar day — "today" is local, not UTC. */
export function todayIso(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
