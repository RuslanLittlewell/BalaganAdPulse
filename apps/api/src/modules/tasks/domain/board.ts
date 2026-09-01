/**
 * The board's columns, left to right as they are drawn.
 *
 * The order is taken literally from the product request, `ARCHIVED` second
 * included. It lives here alone, so moving a column is a one-line change rather
 * than a hunt through the interface.
 */
export const TASK_COLUMNS = [
  "IDEA",
  "ARCHIVED",
  "IN_PROGRESS",
  "NEEDS_FIX",
  "IN_REVIEW",
  "DONE",
] as const;

export type TaskColumn = (typeof TASK_COLUMNS)[number];

/** Where a task lands when the request names no column. */
export const DEFAULT_TASK_COLUMN: TaskColumn = "IDEA";

/** A task's own scale. `ProjectPriority` describes a project by counting the
 * tasks under it, and reads as nonsense on a task itself. */
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export function isTaskColumn(value: string): value is TaskColumn {
  return (TASK_COLUMNS as readonly string[]).includes(value);
}

/**
 * The order a column holds after a card is dropped into it at `position`.
 *
 * A position past the end clamps to last rather than being refused: the board
 * lets you drop a card below the final one, and that is what the gesture means.
 * A card already in the column is moved rather than duplicated, which is what
 * makes reordering within a column the same operation as moving between two.
 */
export function placeInColumn(
  ids: readonly string[],
  movedId: string,
  position: number,
): string[] {
  const without = ids.filter((id) => id !== movedId);
  const target = Math.max(0, Math.min(position, without.length));
  return [...without.slice(0, target), movedId, ...without.slice(target)];
}

/** The order a column holds once a card leaves it, with no gap behind. */
export function reorderAfterRemoval(ids: readonly string[], removedId: string): string[] {
  return ids.filter((id) => id !== removedId);
}
