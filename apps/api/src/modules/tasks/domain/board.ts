export const TASK_COLUMNS = [
  "IDEA",
  "ARCHIVED",
  "IN_PROGRESS",
  "NEEDS_FIX",
  "IN_REVIEW",
  "DONE",
] as const;

export type TaskColumn = (typeof TASK_COLUMNS)[number];

export const DEFAULT_TASK_COLUMN: TaskColumn = "IDEA";

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export function isTaskColumn(value: string): value is TaskColumn {
  return (TASK_COLUMNS as readonly string[]).includes(value);
}

export function placeInColumn(
  ids: readonly string[],
  movedId: string,
  position: number,
): string[] {
  const without = ids.filter((id) => id !== movedId);
  const target = Math.max(0, Math.min(position, without.length));
  return [...without.slice(0, target), movedId, ...without.slice(target)];
}

export function reorderAfterRemoval(ids: readonly string[], removedId: string): string[] {
  return ids.filter((id) => id !== removedId);
}
