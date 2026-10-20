export const TASK_REPEATS = ["NONE", "DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"] as const;

export type TaskRepeat = (typeof TASK_REPEATS)[number];

const DEFAULT_TASK_REPEAT: TaskRepeat = "NONE";

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

const END_OF_DAY = "24:00";

export const MINUTES_PER_DAY = 24 * 60;

export function isEndTime(value: string): boolean {
  return value === END_OF_DAY || isTimeOfDay(value);
}

export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number) as [number, number];
  return hours * 60 + minutes;
}

function timeOf(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  return `${hours}:${String(minutes % 60).padStart(2, "0")}`;
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
  readonly endTime: string | null;
  readonly repeatEvery: TaskRepeat;
  readonly isCall: boolean;
}

export interface ScheduleChange {
  readonly dueDate?: string | null;
  readonly dueTime?: string | null;
  readonly endTime?: string | null;
  readonly repeatEvery?: TaskRepeat;
  readonly isCall?: boolean;
}

export const UNSCHEDULED: TaskSchedule = {
  dueDate: null,
  dueTime: null,
  endTime: null,
  repeatEvery: DEFAULT_TASK_REPEAT,
  isCall: false,
};

export function mayBeCall(schedule: Pick<TaskSchedule, "dueTime" | "repeatEvery">): boolean {
  return schedule.dueTime !== null && schedule.repeatEvery !== "NONE";
}

function endAfter(current: TaskSchedule, change: ScheduleChange, dueTime: string | null): string | null {
  if (change.endTime !== undefined) return change.endTime;
  if (dueTime === null || current.dueTime === null || current.endTime === null) return null;
  if (dueTime === current.dueTime) return current.endTime;
  return timeOf(minutesOf(dueTime) + minutesOf(current.endTime) - minutesOf(current.dueTime));
}

export function rescheduled(current: TaskSchedule, change: ScheduleChange): TaskSchedule {
  const dueDate = change.dueDate === undefined ? current.dueDate : change.dueDate;
  const dueTime = change.dueDate === null
    ? null
    : change.dueTime === undefined ? current.dueTime : change.dueTime;
  const repeatEvery = change.repeatEvery ?? current.repeatEvery;
  return {
    dueDate,
    dueTime,
    endTime: endAfter(current, change, dueTime),
    repeatEvery,
    isCall: change.isCall ?? (current.isCall && mayBeCall({ dueTime, repeatEvery })),
  };
}
