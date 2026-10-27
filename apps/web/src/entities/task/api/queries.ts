import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TASK_COLUMNS, tasksApi, type Task, type TaskColumn, type TaskInput, type TaskMove } from "./api.js";
import type { QueryClient } from "@tanstack/react-query";
import { endKeepingLength, nextDueDate } from "../lib/schedule.js";
import { viewerTimeZone } from "../lib/zone.js";

export const TASKS_KEY = ["tasks"] as const;

export type TaskEvent =
  | { kind: "task.created"; orgId: string; projectId: string | null; task: Task }
  | { kind: "task.updated"; orgId: string; projectId: string | null; task: Task }
  | { kind: "task.moved"; orgId: string; projectId: string | null; task: Task }
  | { kind: "task.deleted"; orgId: string; projectId: string | null; taskId: string };

export interface UseTasksOptions {
  projectId?: string;
  enabled?: boolean;
}

export function useTasks({ projectId, enabled = true }: UseTasksOptions = {}) {
  return useQuery({
    queryKey: [...TASKS_KEY, projectId ?? null],
    queryFn: () => tasksApi.list(projectId),
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

function writeTask(qc: QueryClient, task: Task): void {
  for (const [key, tasks] of qc.getQueriesData<Task[]>({ queryKey: TASKS_KEY })) {
    if (!tasks) continue;
    qc.setQueryData<Task[]>(key, applyTaskEvent(tasks, {
      kind: "task.updated", orgId: task.orgId, projectId: task.projectId, task,
    }, filterOfKey(key)));
  }
}

function cachedTask(qc: QueryClient, id: string): Task | undefined {
  return qc.getQueriesData<Task[]>({ queryKey: TASKS_KEY })
    .flatMap(([, tasks]) => tasks ?? [])
    .find((task) => task.id === id);
}

export function useRescheduleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dueDate, dueTime }: { id: string; dueDate: string | null; dueTime?: string | null }) => {
      const time = dueTime === undefined ? cachedTask(qc, id)?.dueTime : dueTime;
      return tasksApi.update(id, time === undefined ? { dueDate } : { dueDate, dueTime: time });
    },
    onMutate: async ({ id, dueDate, dueTime }) => {
      const snapshots = qc.getQueriesData<Task[]>({ queryKey: TASKS_KEY });
      for (const [key, tasks] of snapshots) {
        if (!tasks) continue;
        qc.setQueryData<Task[]>(key, tasks.map((task) =>
          (task.id === id
            ? {
                ...task,
                dueDate,
                timeZone: viewerTimeZone(),
                ...(dueTime === undefined
                  ? {}
                  : { dueTime, endTime: endKeepingLength(task.dueTime, task.endTime, dueTime) }),
              }
            : task)));
      }
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      for (const [key, tasks] of context?.snapshots ?? []) qc.setQueryData(key, tasks);
    },
    onSuccess: (task) => writeTask(qc, task),
  });
}

function completed(task: Task): Task {
  if (task.repeatEvery === "NONE" || task.dueDate === null) return task;
  return {
    ...task,
    dueDate: nextDueDate(task.dueDate, task.repeatEvery, task.skipWeekends),
    checklist: task.checklist.map((item) => (item.done ? { ...item, done: false } : item)),
  };
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.complete(id),
    onMutate: async (id) => {
      const snapshots = qc.getQueriesData<Task[]>({ queryKey: TASKS_KEY });
      for (const [key, tasks] of snapshots) {
        if (!tasks) continue;
        qc.setQueryData<Task[]>(key, tasks.map((task) => (task.id === id ? completed(task) : task)));
      }
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      return { snapshots };
    },
    onError: (_error, _id, context) => {
      for (const [key, tasks] of context?.snapshots ?? []) qc.setQueryData(key, tasks);
    },
    onSuccess: (task) => writeTask(qc, task),
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
}

function matchesFilter(filter: TaskListFilter, task: Task): boolean {
  return filter.projectId === null || task.projectId === filter.projectId;
}

export function filterOfKey(key: readonly unknown[]): TaskListFilter {
  const [, projectId] = key;
  return { projectId: typeof projectId === "string" ? projectId : null };
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

  const before = tasks.find((task) => task.id === event.task.id);
  if (before && event.kind === "task.updated" && before.column === event.task.column) {
    return tasks.map((task) => (task.id === event.task.id ? event.task : task));
  }

  const held = before ? tasks : [...tasks, event.task];
  const placed = applyMove(held, event.task.id, { column: event.task.column, position: event.task.position });
  return placed.map((task) => (task.id === event.task.id ? { ...event.task, position: task.position } : task));
}

function renumber(tasks: Task[], column: TaskColumn): Task[] {
  const ordered = tasks
    .filter((task) => task.column === column)
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
  below = false,
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
  if (index < 0) return { column: over.column, position: columnOf(over.column).length };
  return { column: over.column, position: below && over.column !== active.column ? index + 1 : index };
}

export function previewFor(board: Task[], activeId: string, overId: string, below = false): Task[] {
  const active = board.find((task) => task.id === activeId);
  if (!active) return board;

  const placement = placementFor(board, activeId, overId, below);
  if (!placement || placement.column === active.column) return board;

  return applyMove(board, activeId, placement);
}

export function placementAmong(all: Task[], shown: Task[], activeId: string, move: TaskMove): TaskMove {
  const othersIn = (tasks: Task[]) => tasks
    .filter((task) => task.column === move.column && task.id !== activeId)
    .sort((a, b) => a.position - b.position)
    .map((task) => task.id);
  const shownIds = othersIn(shown);
  const allIds = othersIn(all);
  const next = shownIds[move.position];
  if (next !== undefined && allIds.includes(next)) return { column: move.column, position: allIds.indexOf(next) };
  const previous = shownIds[Math.min(move.position, shownIds.length) - 1];
  if (previous !== undefined && allIds.includes(previous)) {
    return { column: move.column, position: allIds.indexOf(previous) + 1 };
  }
  return { column: move.column, position: allIds.length };
}

export function resolveDrop(
  server: Task[],
  preview: Task[] | null,
  activeId: string,
  overId: string | null,
  landing: { readonly container: string; readonly index: number } | null = null,
): TaskMove | null {
  const original = server.find((task) => task.id === activeId);
  if (!original) return null;

  if (landing && isColumn(landing.container)) {
    const shownAt = server
      .filter((task) => task.column === original.column)
      .sort((a, b) => a.position - b.position)
      .findIndex((task) => task.id === activeId);
    const unmoved = landing.container === original.column && landing.index === shownAt;
    return unmoved ? null : { column: landing.container, position: landing.index };
  }

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
