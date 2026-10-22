import type { Task, TaskMove } from "../api/api.js";

export type DoneToggle =
  | { readonly kind: "complete" }
  | { readonly kind: "move"; readonly move: TaskMove };

export function isDone(task: Pick<Task, "column">): boolean {
  return task.column === "DONE" || task.column === "ARCHIVED";
}

export function doneToggleFor(task: Pick<Task, "column" | "repeatEvery">): DoneToggle {
  if (isDone(task)) return { kind: "move", move: { column: "IN_PROGRESS", position: 0 } };
  if (task.repeatEvery !== "NONE") return { kind: "complete" };
  return { kind: "move", move: { column: "DONE", position: 0 } };
}
