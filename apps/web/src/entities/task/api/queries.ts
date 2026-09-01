import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TASK_COLUMNS, tasksApi, type Task, type TaskColumn, type TaskInput, type TaskMove } from "./api.js";

const TASKS_KEY = ["tasks"] as const;

export function useTasks(projectId?: string) {
  return useQuery({
    queryKey: [...TASKS_KEY, projectId ?? null],
    queryFn: () => tasksApi.list(projectId),
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

/**
 * A drag, applied to the cache before the server answers so the card stays
 * under the cursor, and rolled back if the move is refused.
 *
 * The board is one query, so the whole list is rewritten: the moved card takes
 * its new column and position, and the cards around it in both the source and
 * the target column are renumbered densely — the same arithmetic the server
 * does, so the optimistic board and the confirmed one agree.
 */
export function useMoveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: TaskMove }) => tasksApi.move(id, body),
    onMutate: async ({ id, body }) => {
      // Written before anything is awaited. React Query runs the synchronous
      // head of onMutate the moment `mutate` is called, so the board's very
      // next render already shows the card in its new column — await first and
      // it renders once with the card back where it started, which is exactly
      // what reads as the card flying home after a drop.
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
    onSettled: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
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

  return tasks.map((task) => {
    const next = positions.get(task.id);
    return next ? { ...task, ...next } : task;
  });
}

function isColumn(value: string): value is TaskColumn {
  return (TASK_COLUMNS as readonly string[]).includes(value);
}

/**
 * Where a drag would land, given what it is hovering over — a column, or
 * another card.
 *
 * Slots are counted with the dragged card already removed, which is what makes
 * dragging downwards land where the gap appears rather than one place short.
 * The board uses this twice, to preview the gap and to commit the drop, so the
 * placeholder and the saved position cannot disagree.
 */
export function placementFor(
  tasks: Task[],
  activeId: string,
  overId: string,
): TaskMove | null {
  const active = tasks.find((task) => task.id === activeId);
  if (!active) return null;

  const columnOf = (column: TaskColumn) =>
    tasks.filter((task) => task.column === column).sort((a, b) => a.position - b.position);

  // Hovering the column itself: the empty space below the cards.
  if (isColumn(overId)) {
    const target = columnOf(overId).filter((task) => task.id !== activeId);
    return { column: overId, position: target.length };
  }

  const over = tasks.find((task) => task.id === overId);
  if (!over) return null;

  // The index is read from the column *as it stands*, including the dragged
  // card when it is already there. That is exactly what the server splices to
  // after removing it, so dragging down lands below the card you dropped on
  // rather than one slot short of it.
  const index = columnOf(over.column).findIndex((task) => task.id === overId);
  return { column: over.column, position: index < 0 ? columnOf(over.column).length : index };
}

/**
 * What a drop should save.
 *
 * The preview is preferred: it is where the card has been sitting since it
 * crossed into this column, and it was built with the same arithmetic the
 * server applies. But it is only a preview — if the pointer tracked correctly
 * while the preview never re-homed the card, the drop must still be honoured
 * rather than silently discarded, so the drop target is the fallback.
 */
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
