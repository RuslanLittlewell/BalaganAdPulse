import type { Task, TaskPriority } from "../api/api.js";
import { isDone } from "./done.js";
import { daysAfter } from "./schedule.js";
import { inZone } from "./zone.js";

export const DUE_SOON_DAYS = 2;

export type DueWhen = "overdue" | "today" | "tomorrow" | "soon";

export interface DueTask {
  readonly task: Task;
  readonly day: string;
  readonly when: DueWhen;
}

const URGENCY: Record<TaskPriority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function dayIn(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone }).format(now);
}

function whenOf(day: string, today: string): DueWhen {
  if (day < today) return "overdue";
  if (day === today) return "today";
  return day === daysAfter(today, 1) ? "tomorrow" : "soon";
}

function byUrgency(a: DueTask, b: DueTask): number {
  if (a.day !== b.day) return a.day < b.day ? -1 : 1;
  const aTime = a.task.dueTime;
  const bTime = b.task.dueTime;
  if (aTime !== bTime) {
    if (aTime === null) return 1;
    if (bTime === null) return -1;
    return aTime < bTime ? -1 : 1;
  }
  return URGENCY[a.task.priority] - URGENCY[b.task.priority];
}

function isMine(task: Task, membershipId: string): boolean {
  if (task.participantIds.length === 0) return task.createdById === membershipId;
  return task.participantIds.includes(membershipId);
}

export function dueSoon(tasks: readonly Task[], membershipId: string, now: Date, timeZone: string): DueTask[] {
  const today = dayIn(now, timeZone);
  const last = daysAfter(today, DUE_SOON_DAYS);
  return tasks
    .filter((task) => isMine(task, membershipId) && !isDone(task) && task.dueDate !== null)
    .map((task) => inZone(task, timeZone))
    .flatMap((task): DueTask[] => {
      const day = task.dueDate;
      return day !== null && day <= last ? [{ task, day, when: whenOf(day, today) }] : [];
    })
    .sort(byUrgency);
}
