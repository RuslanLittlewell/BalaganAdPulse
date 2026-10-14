import type { Task } from "../api/api.js";

export const NO_PARTICIPANTS = "__nobody__";

export interface ParticipantNamed {
  readonly id: string;
  readonly name: string;
}

export interface ParticipantChoice<TMember extends ParticipantNamed> {
  readonly id: string;
  readonly name: string;
  readonly member: TMember | undefined;
}

export function participantChoices<TMember extends ParticipantNamed>(
  tasks: readonly Task[],
  members: readonly TMember[],
  chosen: readonly string[] = [],
): ParticipantChoice<TMember>[] {
  const byId = new Map(members.map((member) => [member.id, member]));
  const held = new Set<string>();
  let nobody = false;

  for (const task of tasks) {
    if (task.participantIds.length === 0) nobody = true;
    for (const id of task.participantIds) held.add(id);
  }
  for (const id of chosen) {
    if (id === NO_PARTICIPANTS) nobody = true;
    else held.add(id);
  }

  const people = [...held].map((id) => {
    const member = byId.get(id);
    return { id, name: member?.name ?? id, member };
  });
  people.sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return nobody
    ? [...people, { id: NO_PARTICIPANTS, name: NO_PARTICIPANTS, member: undefined }]
    : people;
}

export function tasksOfParticipants(tasks: Task[], chosen: readonly string[]): Task[] {
  if (chosen.length === 0) return tasks;
  const wanted = new Set(chosen);
  return tasks.filter((task) =>
    task.participantIds.length === 0
      ? wanted.has(NO_PARTICIPANTS)
      : task.participantIds.some((id) => wanted.has(id)));
}

export function participantsOf<TMember extends ParticipantNamed>(
  task: Pick<Task, "participantIds">,
  members: ReadonlyMap<string, TMember> | readonly TMember[] | undefined,
): TMember[] {
  if (!members) return [];
  const byId = members instanceof Map
    ? members
    : new Map((members as readonly TMember[]).map((member) => [member.id, member]));
  return task.participantIds.flatMap((id) => {
    const member = byId.get(id);
    return member ? [member] : [];
  });
}
