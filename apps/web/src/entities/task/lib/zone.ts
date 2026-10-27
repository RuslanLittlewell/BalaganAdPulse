import type { Task } from "../api/api.js";
import { MINUTES_PER_DAY, daysAfter, minutesOfTime, occurrencesBetween, timeOfMinutes } from "./schedule.js";

const MINUTE_MS = 60 * 1000;

const formats = new Map<string, Intl.DateTimeFormat>();

export interface WallClock {
  readonly day: string;
  readonly minutes: number;
}

export function viewerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function formatIn(timeZone: string): Intl.DateTimeFormat {
  const known = formats.get(timeZone);
  if (known) return known;
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  formats.set(timeZone, format);
  return format;
}

function wallClockAt(instant: number, timeZone: string): WallClock {
  const parts = Object.fromEntries(
    formatIn(timeZone).formatToParts(new Date(instant)).map(({ type, value }) => [type, value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

function sinceEpoch({ day, minutes }: WallClock): number {
  return Date.parse(`${day}T00:00:00Z`) + minutes * MINUTE_MS;
}

function offsetAt(instant: number, timeZone: string): number {
  return sinceEpoch(wallClockAt(instant, timeZone)) - Math.floor(instant / MINUTE_MS) * MINUTE_MS;
}

function instantOf(clock: WallClock, timeZone: string): number {
  const wall = sinceEpoch(clock);
  return wall - offsetAt(wall - offsetAt(wall, timeZone), timeZone);
}

export function between(clock: WallClock, from: string, to: string): WallClock {
  return from === to ? clock : wallClockAt(instantOf(clock, from), to);
}

export function inZone<T extends Pick<Task, "dueDate" | "dueTime" | "endTime" | "timeZone">>(
  task: T,
  timeZone: string,
): T {
  if (!task.timeZone || task.dueDate === null || task.dueTime === null) return task;
  const start = minutesOfTime(task.dueTime);
  const moved = between({ day: task.dueDate, minutes: start }, task.timeZone, timeZone);
  if (moved.day === task.dueDate && moved.minutes === start) return task;
  return {
    ...task,
    dueDate: moved.day,
    dueTime: timeOfMinutes(moved.minutes),
    endTime: task.endTime === null
      ? null
      : timeOfMinutes(Math.min(moved.minutes + minutesOfTime(task.endTime) - start, MINUTES_PER_DAY)),
  };
}

export const localTask = <T extends Pick<Task, "dueDate" | "dueTime" | "endTime" | "timeZone">>(task: T): T =>
  inZone(task, viewerTimeZone());

export interface Occurrence {
  readonly day: string;
  readonly dueTime: string | null;
  readonly endTime: string | null;
}

type Recurring = Pick<Task, "dueDate" | "dueTime" | "endTime" | "repeatEvery" | "skipWeekends" | "timeZone">;

const FURTHEST_DAY_APART = 2;

export function occurrencesIn(task: Recurring, from: string, to: string, timeZone: string): Occurrence[] {
  const stored = task.timeZone;
  if (task.dueDate === null || task.dueTime === null || !stored || stored === timeZone) {
    return occurrencesBetween(task, from, to).map((day) => ({ day, dueTime: task.dueTime, endTime: task.endTime }));
  }
  const start = minutesOfTime(task.dueTime);
  const length = task.endTime === null ? null : minutesOfTime(task.endTime) - start;
  const due = between({ day: task.dueDate, minutes: start }, timeZone, stored);
  return occurrencesBetween({ ...task, dueDate: due.day }, daysAfter(from, -FURTHEST_DAY_APART), daysAfter(to, FURTHEST_DAY_APART))
    .map((day) => between({ day, minutes: due.minutes }, stored, timeZone))
    .filter(({ day }) => day >= from && day <= to)
    .map(({ day, minutes }) => ({
      day,
      dueTime: timeOfMinutes(minutes),
      endTime: length === null ? null : timeOfMinutes(Math.min(minutes + length, MINUTES_PER_DAY)),
    }));
}
