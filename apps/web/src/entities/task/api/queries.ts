import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TASK_COLUMNS, tasksApi, type Task, type TaskColumn, type TaskInput, type TaskMove } from "./api.js";

export const TASKS_KEY = ["tasks"] as const;

export type TaskEvent =
  | { kind: "task.created"; orgId: string; projectId: string; task: Task }
  | { kind: "task.updated"; orgId: string; projectId: string; task: Task }
  | { kind: "task.moved"; orgId: string; projectId: string; task: Task }
  | { kind: "task.deleted"; orgId: string; projectId: string; taskId: string };

export interface UseTasksOptions {
  projectId?: string;
  campaignId?: string;
  enabled?: boolean;
}

export function useTasks({ projectId, campaignId, enabled = true }: UseTasksOptions = {}) {
  return useQuery({
    queryKey: [...TASKS_KEY, projectId ?? null, campaignId ?? null],
    queryFn: () => tasksApi.list(projectId, campaignId),
    enabled,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TaskInput) => tasksApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: TaskInput }) => tasksApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useMoveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: TaskMove }) => tasksApi.move(id, body),
    onMutate: async ({ id, body }) => {
      const snapshots = qc.getQueriesData<Task[]>({ queryKey: TASKS_KEY });
      for (const [key, tasks] of snapshots) {
        if (!tasks) continue;
        qc.setQueryData<Task[]>(key, applyMove(tasks, id, body));
      }
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      for (const [key, tasks] of context?.snapshots ?? []) qc.setQueryData(key, tasks);
    },
    onSuccess: (moved) => {
      for (const [key, tasks] of qc.getQueriesData<Task[]>({ queryKey: TASKS_KEY })) {
        if (!tasks) continue;
        qc.setQueryData<Task[]>(key, applyTaskEvent(tasks, {
          kind: "task.moved", orgId: moved.orgId, projectId: moved.projectId, task: moved,
        }, filterOfKey(key)));
      }
    },
  });
}

export interface TaskListFilter {
  readonly projectId: string | null;
  readonly campaignId: string | null;
}

function matchesFilter(filter: TaskListFilter, task: Task): boolean {
  if (filter.projectId !== null && task.projectId !== filter.projectId) return false;
  if (filter.campaignId !== null && task.campaignId !== filter.campaignId) return false;
  return true;
}

export function filterOfKey(key: readonly unknown[]): TaskListFilter {
  const [, projectId, campaignId] = key;
  return {
    projectId: typeof projectId === "string" ? projectId : null,
    campaignId: typeof campaignId === "string" ? campaignId : null,
  };
}

export function applyTaskEvent(
  tasks: Task[],
  event: TaskEvent,
  filter?: TaskListFilter,
): Task[] {
  const without = (id: string): Task[] => {
    const removed = tasks.find((task) => task.id === id);
    if (!removed) return tasks;
    return renumber(tasks.filter((task) => task.id !== id), removed.column);
  };

  if (event.kind === "task.deleted") return without(event.taskId);

  if (filter && !matchesFilter(filter, event.task)) return without(event.task.id);

  const known = tasks.some((task) => task.id === event.task.id);
  if (!known) return renumber([...tasks, event.task], event.task.column);

  const before = tasks.find((task) => task.id === event.task.id)!;
  const withTask = tasks.map((task) => (task.id === event.task.id ? event.task : task));
  if (event.kind === "task.updated" && before.column === event.task.column) return withTask;

  return renumber(renumber(withTask, before.column, event.task.id), event.task.column);
}

function renumber(tasks: Task[], column: TaskColumn, pinned?: string): Task[] {
  const ordered = tasks
    .filter((task) => task.column === column && task.id !== pinned)
    .sort((a, b) => a.position - b.position);
  const positions = new Map(ordered.map((task, index) => [task.id, index]));
  return tasks.map((task) => {
    const position = positions.get(task.id);
    return position === undefined || task.position === position ? task : { ...task, position };
  });
}

export function applyMove(tasks: Task[], id: string, move: TaskMove): Task[] {
  const moved = tasks.find((task) => task.id === id);
  if (!moved) return tasks;

  const source = tasks
    .filter((task) => task.column === moved.column && task.id !== id)
    .sort((a, b) => a.position - b.position);
  const target = tasks
    .filter((task) => task.column === move.column && task.id !== id)
    .sort((a, b) => a.position - b.position);

  const at = Math.max(0, Math.min(move.position, target.length));
  const placed = [...target.slice(0, at), { ...moved, column: move.column }, ...target.slice(at)];

  const positions = new Map<string, { column: Task["column"]; position: number }>();
  source.forEach((task, index) => positions.set(task.id, { column: moved.column, position: index }));
  placed.forEach((task, index) => positions.set(task.id, { column: move.column, position: index }));

  let changed = false;
  const next = tasks.map((task) => {
    const placement = positions.get(task.id);
    if (!placement
      || (task.column === placement.column && task.position === placement.position)) return task;
    changed = true;
    return { ...task, ...placement };
  });
  return changed ? next : tasks;
}

function isColumn(value: string): value is TaskColumn {
  return (TASK_COLUMNS as readonly string[]).includes(value);
}

export function placementFor(
  tasks: Task[],
  activeId: string,
  overId: string,
): TaskMove | null {
  const active = tasks.find((task) => task.id === activeId);
  if (!active) return null;

  const columnOf = (column: TaskColumn) =>
    tasks.filter((task) => task.column === column).sort((a, b) => a.position - b.position);

  if (isColumn(overId)) {
    const target = columnOf(overId).filter((task) => task.id !== activeId);
    return { column: overId, position: target.length };
  }

  const over = tasks.find((task) => task.id === overId);
  if (!over) return null;

  const index = columnOf(over.column).findIndex((task) => task.id === overId);
  return { column: over.column, position: index < 0 ? columnOf(over.column).length : index };
}

export function resolveDrop(
  server: Task[],
  preview: Task[] | null,
  activeId: string,
  overId: string | null,
): TaskMove | null {
  const original = server.find((task) => task.id === activeId);
  if (!original) return null;

  const previewed = preview?.find((task) => task.id === activeId);
  if (previewed && (previewed.column !== original.column || previewed.position !== original.position)) {
    return { column: previewed.column, position: previewed.position };
  }

  if (!overId) return null;
  const placement = placementFor(server, activeId, overId);
  if (!placement) return null;
  if (placement.column === original.column && placement.position === original.position) return null;
  return placement;
}
