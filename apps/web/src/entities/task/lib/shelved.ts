import type { Task } from "../api/api.js";

export const SHELF_AFTER_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isShelved(task: Pick<Task, "column" | "archivedAt">, now: Date): boolean {
  if (task.column !== "ARCHIVED" || task.archivedAt === null) return false;
  return now.getTime() - new Date(task.archivedAt).getTime() >= SHELF_AFTER_DAYS * DAY_MS;
}
