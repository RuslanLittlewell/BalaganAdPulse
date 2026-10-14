const DAY_MS = 24 * 60 * 60 * 1000;
export const HOURS_PER_DAY = 24;
export const MINUTES_PER_HOUR = 60;
export const CALENDAR_HOUR_HEIGHT = 80;
export const CALENDAR_SNAP_MINUTES = 15;
export const CALENDAR_START_HOUR = 6;

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

export function minutesOfTime(time: string | null): number | null {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return Math.max(0, Math.min((HOURS_PER_DAY * MINUTES_PER_HOUR) - 1, hours * MINUTES_PER_HOUR + minutes));
}

export function timeOfMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.min((HOURS_PER_DAY * MINUTES_PER_HOUR) - 1, minutes));
  const hours = Math.floor(clamped / MINUTES_PER_HOUR);
  const mins = clamped % MINUTES_PER_HOUR;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function snapMinutes(minutes: number, step = CALENDAR_SNAP_MINUTES): number {
  return Math.max(0, Math.min(
    (HOURS_PER_DAY * MINUTES_PER_HOUR) - step,
    Math.round(minutes / step) * step,
  ));
}

export function minutesFromTop(top: number, hourHeight = CALENDAR_HOUR_HEIGHT): number {
  const displayedMinutes = snapMinutes((top / hourHeight) * MINUTES_PER_HOUR);
  return (displayedMinutes + (CALENDAR_START_HOUR * MINUTES_PER_HOUR)) % (HOURS_PER_DAY * MINUTES_PER_HOUR);
}

export function topOfTime(time: string | null, hourHeight = CALENDAR_HOUR_HEIGHT): number | null {
  const minutes = minutesOfTime(time);
  if (minutes === null) return null;

  const displayedMinutes =
    (minutes - (CALENDAR_START_HOUR * MINUTES_PER_HOUR) + (HOURS_PER_DAY * MINUTES_PER_HOUR)) %
    (HOURS_PER_DAY * MINUTES_PER_HOUR);
  return (displayedMinutes / MINUTES_PER_HOUR) * hourHeight;
}

const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;

export const DEFAULT_TASK_MINUTES = 60;

export interface TimedTask {
  readonly dueTime: string | null;
  readonly endTime: string | null;
}

export interface PlacedTask<T> {
  readonly task: T;
  readonly start: number;
  readonly end: number;
  readonly lane: number;
  readonly lanes: number;
}

function endMinutes(endTime: string | null): number | null {
  if (endTime === "24:00") return MINUTES_PER_DAY;
  return minutesOfTime(endTime);
}

export function spanOfTask(task: TimedTask): { start: number; end: number } | null {
  const start = minutesOfTime(task.dueTime);
  if (start === null) return null;
  const end = endMinutes(task.endTime);
  return {
    start,
    end: end !== null && end > start ? end : Math.min(start + DEFAULT_TASK_MINUTES, MINUTES_PER_DAY),
  };
}

export function layoutDay<T extends TimedTask>(tasks: readonly T[]): PlacedTask<T>[] {
  const spans = tasks
    .flatMap((task) => {
      const span = spanOfTask(task);
      return span ? [{ task, ...span }] : [];
    })
    .sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  const placed: PlacedTask<T>[] = [];
  let cluster: { task: T; start: number; end: number; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = 0;

  const close = () => {
    for (const item of cluster) placed.push({ ...item, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };

  for (const span of spans) {
    if (cluster.length > 0 && span.start >= clusterEnd) close();
    const free = laneEnds.findIndex((end) => end <= span.start);
    const lane = free === -1 ? laneEnds.length : free;
    laneEnds[lane] = span.end;
    clusterEnd = cluster.length === 0 ? span.end : Math.max(clusterEnd, span.end);
    cluster.push({ ...span, lane });
  }
  close();

  return placed;
}

export function startKeepingWithinDay(task: TimedTask, start: number): number {
  const span = spanOfTask(task);
  if (span === null || task.endTime === null) return start;
  return Math.min(start, MINUTES_PER_DAY - (span.end - span.start));
}
