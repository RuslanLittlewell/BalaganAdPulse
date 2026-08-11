/** The property types the API sends; also the display rules for a value. */
export type PropertyType = "NUMBER" | "MONEY" | "PERCENT" | "TEXT";

const MISSING = "—";

function grouped(value: number, minimumFractionDigits: number, maximumFractionDigits: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits, maximumFractionDigits });
}

/**
 * Values arrive as strings with four decimals to preserve precision, so parsing
 * happens here and nowhere else — the parsed number is for display only.
 */
export function formatValue(value: string | null, type: PropertyType): string {
  if (value === null || value === "") return MISSING;
  if (type === "TEXT") return value;

  const number = Number(value);
  if (!Number.isFinite(number)) return MISSING;

  if (type === "MONEY") return grouped(number, 2, 2);
  if (type === "PERCENT") return `${grouped(number, 2, 2)}%`;
  return grouped(number, 0, 2);
}

/** "2026-08-01" -> "01 Aug". Parsed as UTC so the local zone cannot shift the day. */
export function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

/** "2026-08-31" -> "2026-09-01". UTC arithmetic, so no daylight-saving shift moves the day. */
export function nextDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** The viewer's own calendar day — "today" is local, not UTC. */
export function todayIso(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
