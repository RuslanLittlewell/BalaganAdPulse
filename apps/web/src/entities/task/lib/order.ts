import { isDone } from "./done.js";
import type { Task } from "../api/api.js";

function byDue(left: Task, right: Task): number {
  if (left.dueDate === right.dueDate) return (left.dueTime ?? "99:99").localeCompare(right.dueTime ?? "99:99");
  if (left.dueDate === null) return 1;
  if (right.dueDate === null) return -1;
  return left.dueDate.localeCompare(right.dueDate);
}

export function tasksByDue(tasks: readonly Task[], options: { openFirst?: boolean } = {}): Task[] {
  return [...tasks].sort((left, right) => {
    if (options.openFirst && isDone(left) !== isDone(right)) return isDone(left) ? 1 : -1;
    return byDue(left, right);
  });
}

export function openTaskCount(tasks: readonly Task[]): number {
  return tasks.filter((task) => !isDone(task)).length;
}
