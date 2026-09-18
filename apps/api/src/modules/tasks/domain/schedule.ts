export const TASK_REPEATS = ["NONE", "DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"] as const;

export type TaskRepeat = (typeof TASK_REPEATS)[number];

export const DEFAULT_TASK_REPEAT: TaskRepeat = "NONE";

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isCalendarDay(value: string): boolean {
  if (!CALENDAR_DAY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isTimeOfDay(value: string): boolean {
  return TIME_OF_DAY.test(value);
}

export function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function dateToDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type RepeatingTask = Exclude<TaskRepeat, "NONE">;

const DAYS_APART: Record<Exclude<RepeatingTask, "MONTHLY">, number> = {
  DAILY: 1,
  WEEKLY: 7,
  BIWEEKLY: 14,
};

export function nextOccurrence(day: string, repeat: RepeatingTask): string {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  if (repeat !== "MONTHLY") {
    return dateToDay(new Date(Date.UTC(year, month - 1, date + DAYS_APART[repeat])));
  }
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const lastOfMonth = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  return dateToDay(new Date(Date.UTC(nextYear, nextMonth - 1, Math.min(date, lastOfMonth))));
}

export interface TaskSchedule {
  readonly dueDate: string | null;
  readonly dueTime: string | null;
  readonly repeatEvery: TaskRepeat;
}

export interface ScheduleChange {
  readonly dueDate?: string | null;
  readonly dueTime?: string | null;
  readonly repeatEvery?: TaskRepeat;
}

export const UNSCHEDULED: TaskSchedule = {
  dueDate: null,
  dueTime: null,
  repeatEvery: DEFAULT_TASK_REPEAT,
};

export function rescheduled(current: TaskSchedule, change: ScheduleChange): TaskSchedule {
  const dueDate = change.dueDate === undefined ? current.dueDate : change.dueDate;
  const dueTime = change.dueDate === null
    ? null
    : change.dueTime === undefined ? current.dueTime : change.dueTime;
  return { dueDate, dueTime, repeatEvery: change.repeatEvery ?? current.repeatEvery };
}
