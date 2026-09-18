const DAY_MS = 24 * 60 * 60 * 1000;

function asDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function asIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDays(iso: string, days: number): string {
  return asIso(new Date(asDate(iso).getTime() + days * DAY_MS));
}

export function startOfWeek(iso: string): string {
  const weekday = asDate(iso).getUTCDay();
  return shiftDays(iso, weekday === 0 ? -6 : 1 - weekday);
}

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, index) => shiftDays(start, index));
}

export function shiftWeek(start: string, weeks: number): string {
  return shiftDays(start, weeks * 7);
}

export function isSameWeek(a: string, b: string): boolean {
  return startOfWeek(a) === startOfWeek(b);
}

function part(iso: string, options: Intl.DateTimeFormatOptions): string {
  return asDate(iso).toLocaleDateString("ru-RU", { timeZone: "UTC", ...options });
}

export function dayNumber(iso: string): string {
  return part(iso, { day: "numeric" });
}

export function dayAndMonth(iso: string): string {
  return part(iso, { day: "numeric", month: "long" });
}

function monthName(iso: string): string {
  return dayAndMonth(iso).replace(/^\d+\s/, "");
}

export function weekdayName(iso: string): string {
  return part(iso, { weekday: "long" });
}

export function dayTitle(iso: string): string {
  return `${weekdayName(iso)}, ${dayAndMonth(iso)}`;
}

export function weekLabel(start: string): string {
  const end = shiftDays(start, 6);
  const [startYear, endYear] = [start.slice(0, 4), end.slice(0, 4)];
  const to = `${dayAndMonth(end)} ${endYear}`;

  if (startYear !== endYear) return `${dayAndMonth(start)} ${startYear} – ${to}`;
  if (monthName(start) !== monthName(end)) return `${dayAndMonth(start)} – ${to}`;
  return `${dayNumber(start)} – ${to}`;
}

export function dayOfDrop(
  days: readonly string[],
  tasks: readonly { id: string; dueDate: string | null }[],
  overId: string,
): string | null {
  if (days.includes(overId)) return overId;
  const over = tasks.find((task) => task.id === overId);
  return over?.dueDate ?? null;
}

export function tasksOfDay<T extends { dueDate: string | null; dueTime: string | null; position: number }>(
  tasks: readonly T[],
  day: string,
): T[] {
  return tasks
    .filter((task) => task.dueDate === day)
    .sort((a, b) => {
      if (a.dueTime === b.dueTime) return a.position - b.position;
      if (a.dueTime === null) return 1;
      if (b.dueTime === null) return -1;
      return a.dueTime.localeCompare(b.dueTime);
    });
}
