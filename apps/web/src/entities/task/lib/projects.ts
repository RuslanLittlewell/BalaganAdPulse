import type { Task } from "../api/api.js";

export const NO_PROJECT_TASK = "__no_project__";

export interface ProjectNamed {
  readonly id: string;
  readonly name: string;
}

export interface ProjectChoice<TProject extends ProjectNamed> {
  readonly id: string;
  readonly name: string;
  readonly project: TProject | undefined;
}

export function projectChoices<TProject extends ProjectNamed>(
  tasks: readonly Task[],
  projects: readonly TProject[],
  chosen: readonly string[] = [],
): ProjectChoice<TProject>[] {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const held = new Set<string>();
  let projectless = false;

  for (const task of tasks) {
    if (task.projectId === null) projectless = true;
    else held.add(task.projectId);
  }
  for (const id of chosen) {
    if (id === NO_PROJECT_TASK) projectless = true;
    else held.add(id);
  }

  const named = [...held].map((id) => {
    const project = byId.get(id);
    return { id, name: project?.name ?? id, project };
  });
  named.sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return projectless
    ? [...named, { id: NO_PROJECT_TASK, name: NO_PROJECT_TASK, project: undefined }]
    : named;
}

export function tasksOfProjects(tasks: Task[], chosen: readonly string[]): Task[] {
  if (chosen.length === 0) return tasks;
  const wanted = new Set(chosen);
  return tasks.filter((task) => wanted.has(task.projectId ?? NO_PROJECT_TASK));
}
