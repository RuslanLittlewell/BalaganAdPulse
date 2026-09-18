import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCompleteTask,
  useRescheduleTask,
  type Task,
} from "@/entities/task/index.js";
import { useMembers } from "@/entities/membership/index.js";
import { useProjects } from "@/entities/project/index.js";
import { useCampaignNameById } from "@/entities/campaign/index.js";
import { useCan } from "@/features/permissions/index.js";
import { t } from "@/shared/config/index.js";
import { Button, EmptyState, Loader, toIso } from "@/shared/ui/index.js";
import { TaskCard } from "@/widgets/task-board/TaskCard.js";
import { CalendarDay } from "./CalendarDay.js";
import { dayOfDrop, shiftWeek, startOfWeek, tasksOfDay, weekDays, weekLabel } from "./week.js";

export interface TaskCalendarProps {
  tasks: Task[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  today?: string;
  onOpen?: (task: Task) => void;
}

export function TaskCalendar({ tasks, isLoading, isError, today, onOpen }: TaskCalendarProps) {
  const now = today ?? toIso(new Date());
  const reschedule = useRescheduleTask();
  const complete = useCompleteTask();
  const draggable = useCan("update", "task");
  const { data: projects } = useProjects();
  const { data: members } = useMembers();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(now));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const board = tasks ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const projectById = useMemo(
    () => new Map((projects ?? []).map((project) => [project.id, project])),
    [projects],
  );
  const memberById = useMemo(
    () => new Map((members ?? []).map((member) => [member.id, member])),
    [members],
  );

  const campaignNameById = useCampaignNameById();

  const dragging = board.find((task) => task.id === draggingId) ?? null;

  if (isLoading) return <Loader />;
  if (isError) return <EmptyState title={t("tasks.loadFailed")} />;

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    setDraggingId(null);
    if (!event.over) return;

    const day = dayOfDrop(days, board, String(event.over.id));
    const task = board.find((held) => held.id === activeId);
    if (!day || !task || task.dueDate === day) return;

    reschedule.mutate(
      { id: activeId, dueDate: day },
      { onError: () => setMoveError(t("tasks.moveFailed")) },
    );
  }

  return (
    <DndContext
      sensors={sensors}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={(event: DragStartEvent) => {
        setDraggingId(String(event.active.id));
        setMoveError(null);
      }}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <header className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("tasks.calendar.previousWeek")}
            onClick={() => setWeekStart((start) => shiftWeek(start, -1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("tasks.calendar.nextWeek")}
            onClick={() => setWeekStart((start) => shiftWeek(start, 1))}
          >
            <ChevronRight />
          </Button>
          <h2 className="min-w-0 truncate text-sm font-semibold">{weekLabel(weekStart)}</h2>
          <Button
            type="button"
            variant="outline"
            className="ml-auto"
            onClick={() => setWeekStart(startOfWeek(now))}
          >
            {t("tasks.calendar.today")}
          </Button>
        </header>

        {moveError ? <p role="alert" className="text-sm text-destructive">{moveError}</p> : null}

        <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto pb-2">
          {days.map((day) => (
            <CalendarDay
              key={day}
              day={day}
              today={day === now}
              tasks={tasksOfDay(board, day)}
              draggable={draggable}
              draggingId={draggingId}
              projects={projectById}
              campaigns={campaignNameById}
              members={memberById}
              onOpen={onOpen}
              onComplete={draggable
                ? (task) => complete.mutate(task.id, {
                    onError: () => setMoveError(t("tasks.completeFailed")),
                  })
                : undefined}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {dragging ? (
          <TaskCard
            task={dragging}
            draggable={false}
            project={dragging.projectId ? projectById.get(dragging.projectId) : undefined}
            campaignName={dragging.campaignId ? campaignNameById.get(dragging.campaignId) : undefined}
            assignee={dragging.assigneeId ? memberById.get(dragging.assigneeId) : undefined}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
