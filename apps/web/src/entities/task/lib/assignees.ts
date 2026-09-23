import type { Task } from "../api/api.js";

export const UNASSIGNED_TASK = "__unassigned__";

export interface AssigneeNamed {
  readonly id: string;
  readonly name: string;
}

export interface AssigneeChoice<TMember extends AssigneeNamed> {
  readonly id: string;
  readonly name: string;
  readonly member: TMember | undefined;
}

export function assigneeChoices<TMember extends AssigneeNamed>(
  tasks: readonly Task[],
  members: readonly TMember[],
  chosen: readonly string[] = [],
): AssigneeChoice<TMember>[] {
  const byId = new Map(members.map((member) => [member.id, member]));
  const held = new Set<string>();
  let unheld = false;

  for (const task of tasks) {
    if (task.assigneeId === null) unheld = true;
    else held.add(task.assigneeId);
  }
  for (const id of chosen) {
    if (id === UNASSIGNED_TASK) unheld = true;
    else held.add(id);
  }

  const people = [...held].map((id) => {
    const member = byId.get(id);
    return { id, name: member?.name ?? id, member };
  });
  people.sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return unheld
    ? [...people, { id: UNASSIGNED_TASK, name: UNASSIGNED_TASK, member: undefined }]
    : people;
}

export function tasksOfAssignees(tasks: Task[], chosen: readonly string[]): Task[] {
  if (chosen.length === 0) return tasks;
  const wanted = new Set(chosen);
  return tasks.filter((task) =>
    wanted.has(task.assigneeId ?? UNASSIGNED_TASK));
}
