import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  TASK_COLUMNS,
  applyMove,
  placementFor,
  resolveDrop,
  useMoveTask,
  useTasks,
  type Task,
  type TaskColumn,
} from "@/entities/task/index.js";
import { useMembers } from "@/entities/membership/index.js";
import { useProjects } from "@/entities/project/index.js";
import { useCan } from "@/features/permissions/index.js";
import { t } from "@/shared/config/index.js";
import { EmptyState, Loader } from "@/shared/ui/index.js";
import { TaskCard } from "./TaskCard.js";
import { boardCollisionDetection } from "./collision.js";
import { TaskColumnPanel } from "./TaskColumn.js";

export interface TaskBoardProps {
  projectId?: string;
  onOpen?: (task: Task) => void;
}

export function TaskBoard({ projectId, onOpen }: TaskBoardProps) {
  const { data: tasks, isLoading, isError } = useTasks(projectId);
  const move = useMoveTask();
  const draggable = useCan("update", "task");
  const { data: projects } = useProjects();
  const { data: members } = useMembers();
  const [moveError, setMoveError] = useState<string | null>(null);

  const [preview, setPreview] = useState<Task[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => { if (!draggingId) setPreview(null); }, [draggingId, tasks]);

  const board = preview ?? tasks ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byColumn = useMemo(() => {
    const grouped = new Map<TaskColumn, Task[]>(TASK_COLUMNS.map((column) => [column, []]));
    for (const task of board) grouped.get(task.column)?.push(task);
    for (const column of grouped.values()) column.sort((a, b) => a.position - b.position);
    return grouped;
  }, [board]);

  const projectById = useMemo(
    () => new Map((projects ?? []).map((project) => [project.id, project])),
    [projects],
  );
  const memberById = useMemo(
    () => new Map((members ?? []).map((member) => [member.id, member])),
    [members],
  );

  const dragging = board.find((task) => task.id === draggingId) ?? null;

  if (isLoading) return <Loader />;
  if (isError) return <EmptyState title={t("tasks.loadFailed")} />;

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
    setPreview(tasks ?? []);
    setMoveError(null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const placement = placementFor(board, String(active.id), String(over.id));
    if (!placement) return;
    setPreview((current) => applyMove(current ?? board, String(active.id), placement));
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    const placement = resolveDrop(tasks ?? [], preview, activeId, overId);

    setDraggingId(null);
    if (!placement) { setPreview(null); return; }

    // Mutate first: its optimistic write lands synchronously, so clearing the
    // preview afterwards hands over to a cache that already shows the card in
    // its new column. The other order renders the old layout for a frame.
    move.mutate(
      { id: activeId, body: placement },
      { onError: () => setMoveError(t("tasks.moveFailed")) },
    );
    setPreview(null);
  }

  function handleDragCancel() {
    setDraggingId(null);
    setPreview(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {moveError ? (
        <p role="alert" className="mb-2 text-sm text-destructive">{moveError}</p>
      ) : null}

      <div className="flex h-full min-h-0 gap-3 overflow-x-auto pb-2">
        {TASK_COLUMNS.map((column) => (
          <TaskColumnPanel
            key={column}
            column={column}
            tasks={byColumn.get(column) ?? []}
            draggable={draggable}
            draggingId={draggingId}
            projects={projectById}
            members={memberById}
            onOpen={onOpen}
          />
        ))}
      </div>
      <DragOverlay>
        {dragging ? (
          <TaskCard
            task={dragging}
            draggable={false}
            project={projectById.get(dragging.projectId)}
            assignee={dragging.assigneeId ? memberById.get(dragging.assigneeId) : undefined}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
