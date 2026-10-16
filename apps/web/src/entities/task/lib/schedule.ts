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

function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function nextOccurrence(day: string, repeat: Exclude<TaskRepeat, "NONE">): string {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  if (repeat !== "MONTHLY") {
    return dayOf(new Date(Date.UTC(year, month - 1, date + DAYS_APART[repeat])));
  }
  const lastOfNextMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return dayOf(new Date(Date.UTC(year, month, Math.min(date, lastOfNextMonth))));
}
