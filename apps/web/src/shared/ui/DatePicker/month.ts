/**
 * "03 августа 2026 г." — a day's accessible name inside the calendar grid. Tighter
 * than react-day-picker's default, which prefixes the weekday, and stable enough to
 * be worth owning: it is what the picker's tests point at.
 */
export function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "2026-08-03" -> a local-midnight Date, which is the calendar's own unit. */
export function fromIso(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** The inverse of `fromIso`. Local fields, so a day never shifts across the boundary. */
export function toIso(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
