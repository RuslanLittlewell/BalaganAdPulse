import type { Task, TaskRepeat } from "../api/api.js";

export const END_OF_DAY = "24:00";

export const MINUTES_PER_DAY = 24 * 60;

export function minutesOfTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number) as [number, number];
  return hours * 60 + minutes;
}

export function timeOfMinutes(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  return `${hours}:${String(minutes % 60).padStart(2, "0")}`;
}

export function timeRange(task: Pick<Task, "dueTime" | "endTime">): string | null {
  if (task.dueTime === null) return null;
  return task.endTime ? `${task.dueTime}–${task.endTime}` : task.dueTime;
}

export function endKeepingLength(
  start: string | null,
  end: string | null,
  nextStart: string | null,
): string | null {
  if (start === null || end === null || nextStart === null) return null;
  const next = minutesOfTime(nextStart) + minutesOfTime(end) - minutesOfTime(start);
  return timeOfMinutes(Math.min(next, MINUTES_PER_DAY));
}

export function endShownAs(end: string | null): string | null {
  return end === END_OF_DAY ? "00:00" : end;
}

export function endEnteredAs(entered: string | null): string | null {
  return entered === "00:00" ? END_OF_DAY : entered;
}

export function endsAfterStart(start: string, end: string): boolean {
  return minutesOfTime(end) > minutesOfTime(start);
}

const DAYS_APART: Record<Exclude<TaskRepeat, "NONE" | "MONTHLY">, number> = {
  DAILY: 1,
  WEEKLY: 7,
  BIWEEKLY: 14,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function partsOf(day: string): [number, number, number] {
  return day.split("-").map(Number) as [number, number, number];
}

function daysAfter(day: string, days: number): string {
  const [year, month, date] = partsOf(day);
  return dayOf(new Date(Date.UTC(year, month - 1, date + days)));
}

function monthsAfter(day: string, months: number): string {
  const [year, month, date] = partsOf(day);
  const lastOfMonth = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return dayOf(new Date(Date.UTC(year, month - 1 + months, Math.min(date, lastOfMonth))));
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

export function nextOccurrence(day: string, repeat: Exclude<TaskRepeat, "NONE">): string {
  return repeat === "MONTHLY" ? monthsAfter(day, 1) : daysAfter(day, DAYS_APART[repeat]);
}

export function mayBeCall(schedule: Pick<Task, "dueTime" | "repeatEvery">): boolean {
  return schedule.dueTime !== null && schedule.repeatEvery !== "NONE";
}

export function occurrencesBetween(
  task: Pick<Task, "dueDate" | "repeatEvery">,
  from: string,
  to: string,
): string[] {
  const { dueDate, repeatEvery } = task;
  if (dueDate === null) return [];
  if (repeatEvery === "NONE") return dueDate >= from && dueDate <= to ? [dueDate] : [];
  const nth = (count: number) => repeatEvery === "MONTHLY"
    ? monthsAfter(dueDate, count)
    : daysAfter(dueDate, count * DAYS_APART[repeatEvery]);
  const skipped = repeatEvery === "MONTHLY"
    ? 0
    : Math.max(0, Math.floor(daysBetween(dueDate, from) / DAYS_APART[repeatEvery]));
  const days: string[] = [];
  for (let count = skipped; nth(count) <= to; count += 1) {
    if (nth(count) >= from) days.push(nth(count));
  }
  return days;
}
