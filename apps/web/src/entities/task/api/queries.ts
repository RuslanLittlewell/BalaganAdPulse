import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TASK_COLUMNS, tasksApi, type Task, type TaskColumn, type TaskInput, type TaskMove } from "./api.js";

export const TASKS_KEY = ["tasks"] as const;

/** What the server publishes over the socket. Mirrors the API's own union. */
export type TaskEvent =
  | { kind: "task.created"; orgId: string; projectId: string; task: Task }
  | { kind: "task.updated"; orgId: string; projectId: string; task: Task }
  | { kind: "task.moved"; orgId: string; projectId: string; task: Task }
  | { kind: "task.deleted"; orgId: string; projectId: string; taskId: string };

export interface UseTasksOptions {
  projectId?: string;
  campaignId?: string;
  /**
   * False holds the query back.
   *
   * A screen scoped to one project reads its id from the address, which lands a
   * tick after the first render. Without this it would ask for every task in
   * the organization first and the project's second — one wasted listing, and
   * the wide answer left in the cache.
   */
  enabled?: boolean;
}

/** Both filters are part of the key, not just the request: each combination is
 * a different answer and must never share a cache entry. */
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
    // The server's own row, folded in through the same reducer a socket event
    // uses — so the optimistic guess is replaced by what was actually stored.
    //
    // Deliberately not an invalidation. A refetch here tells the mover nothing
    // they do not already have, and costs one request per drop per person on
    // the board, which is worst exactly when the board is busiest. Everyone
    // else learns about this move over the socket; a member whose socket was
    // down catches up on the refetch that follows a reconnect.
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

/** What a cached listing was narrowed by. `null` means "not narrowed by this". */
export interface TaskListFilter {
  readonly projectId: string | null;
  readonly campaignId: string | null;
}

function matchesFilter(filter: TaskListFilter, task: Task): boolean {
  if (filter.projectId !== null && task.projectId !== filter.projectId) return false;
  if (filter.campaignId !== null && task.campaignId !== filter.campaignId) return false;
  return true;
}

/** The filter a cache key names. The key is `["tasks", projectId, campaignId]`,
 * built by `useTasks`; anything shorter is an unfiltered listing. */
export function filterOfKey(key: readonly unknown[]): TaskListFilter {
  const [, projectId, campaignId] = key;
  return {
    projectId: typeof projectId === "string" ? projectId : null,
    campaignId: typeof campaignId === "string" ? campaignId : null,
  };
}

/**
 * A change another member made, folded into the board this one is holding.
 *
 * The event is authoritative about the card it names; the cards around it are
 * renumbered here with the same arithmetic the optimistic path uses, so a move
 * that arrives over the socket and a move made locally leave the board in the
 * same state. That also makes it idempotent: the mover receives their own
 * event, and applying it must confirm the board rather than shuffle it again.
 */
export function applyTaskEvent(
  tasks: Task[],
  event: TaskEvent,
  filter?: TaskListFilter,
): Task[] {
  /** Takes a card out and closes the gap behind it — or the next drop computes
   * against a column numbered 1,2 with no 0 and lands somewhere nobody aimed at. */
  const without = (id: string): Task[] => {
    const removed = tasks.find((task) => task.id === id);
    if (!removed) return tasks;
    return renumber(tasks.filter((task) => task.id !== id), removed.column);
  };

  if (event.kind === "task.deleted") return without(event.taskId);

  /**
   * A listing narrowed to one project or campaign stays narrowed.
   *
   * Events arrive for every task in the organization and every cached listing
   * is asked to fold them in, so without this a campaign's list gains other
   * campaigns' tasks the moment anyone creates one. A task that no longer
   * matches leaves rather than being ignored: it did not go away, it is
   * somebody else's row now.
   */
  if (filter && !matchesFilter(filter, event.task)) return without(event.task.id);

  const known = tasks.some((task) => task.id === event.task.id);
  // A card can arrive by being moved into a column this board is showing, not
  // only by being created — treat an unknown id as an addition either way.
  if (!known) return renumber([...tasks, event.task], event.task.column);

  const before = tasks.find((task) => task.id === event.task.id)!;
  const withTask = tasks.map((task) => (task.id === event.task.id ? event.task : task));
  if (event.kind === "task.updated" && before.column === event.task.column) return withTask;

  // Renumber the column it left as well as the one it joined.
  return renumber(renumber(withTask, before.column, event.task.id), event.task.column);
}

/**
 * Rewrites one column as a dense 0..n-1 sequence, honouring the position the
 * event asked for. `pinned` is excluded, so the column a card left closes up
 * without the card being counted back into it.
 */
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

  /**
   * Identity is part of the contract, not an optimisation.
   *
   * The board writes this into state on every drag-over, and dnd-kit
   * re-measures its droppables on every render while a drag is in flight —
   * which fires the next drag-over. A fresh array each time closes that circle
   * into an infinite loop. So a card that did not move stays the same object,
   * and a move that changes nothing answers the array it was given.
   */
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
