export interface MonthCursor {
  year: number;
  /** Zero-based, matching `Date`. */
  month: number;
}

/** Column headings. Locale abbreviations, not app copy — the week starts on Monday. */
export const WEEKDAY_INITIALS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/**
 * The 42 days a month grid shows: six weeks from the Monday on or before the first, so
 * the grid keeps one height all year. UTC throughout — a day is a pure date and must
 * not shift with the viewer's zone.
 */
export function monthDays({ year, month }: MonthCursor): string[] {
  const first = new Date(Date.UTC(year, month, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) =>
    new Date(Date.UTC(year, month, 1 - mondayOffset + index)).toISOString().slice(0, 10),
  );
}

/** "August 2026" — the grid's heading. */
export function monthLabel({ year, month }: MonthCursor): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "03 August 2026" — a day's accessible name, unique across a grid that shows three months. */
export function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function monthOf(iso: string): MonthCursor {
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) - 1 };
}

export function stepMonth({ year, month }: MonthCursor, delta: number): MonthCursor {
  const stepped = new Date(Date.UTC(year, month + delta, 1));
  return { year: stepped.getUTCFullYear(), month: stepped.getUTCMonth() };
}
