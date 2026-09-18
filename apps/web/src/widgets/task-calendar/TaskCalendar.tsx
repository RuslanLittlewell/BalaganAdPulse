import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Paperclip,
  Repeat,
} from "lucide-react";
import {
  useCompleteTask,
  useRescheduleTask,
  type Task,
} from "@/entities/task/index.js";
import {
  useMembers,
  MemberAvatar,
  type Membership,
} from "@/entities/membership/index.js";
import {
  useProjects,
  ProjectAvatar,
  type Project,
} from "@/entities/project/index.js";
import { useCampaignNameById } from "@/entities/campaign/index.js";
import { useCan } from "@/features/permissions/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import { Button, EmptyState, Loader, toIso } from "@/shared/ui/index.js";
import {
  CALENDAR_HOUR_HEIGHT,
  CALENDAR_START_HOUR,
  HOURS_PER_DAY,
  dayAndMonth,
  dayTitle,
  minutesFromTop,
  shiftWeek,
  startOfWeek,
  tasksOfDay,
  timeOfMinutes,
  topOfTime,
  weekDays,
  weekLabel,
  weekdayName,
} from "./week.js";

export interface TaskCalendarProps {
  tasks: Task[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  today?: string;
  onOpen?: (task: Task) => void;
}

const EVENT_HEIGHT = 76;
const HOURS = Array.from({ length: HOURS_PER_DAY }, (_, hour) => hour);

const PRIORITY_BAR: Record<Task["priority"], string> = {
  LOW: "bg-border",
  MEDIUM: "bg-sky-400",
  HIGH: "bg-amber-400",
  URGENT: "bg-red-500",
};

export function TaskCalendar({
  tasks,
  isLoading,
  isError,
  today,
  onOpen,
}: TaskCalendarProps) {
  const now = today ?? toIso(new Date());
  const reschedule = useRescheduleTask();
  const complete = useCompleteTask();
  const draggable = useCan("update", "task");
  const { data: projects } = useProjects();
  const { data: members } = useMembers();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(now));
  const [moveError, setMoveError] = useState<string | null>(null);

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const board = tasks ?? [];

  const projectById = useMemo(
    () => new Map((projects ?? []).map((project) => [project.id, project])),
    [projects],
  );
  const memberById = useMemo(
    () => new Map((members ?? []).map((member) => [member.id, member])),
    [members],
  );

  const campaignNameById = useCampaignNameById();

  const rescheduleTask = useCallback(
    (task: Task, dueDate: string, dueTime: string) => {
      if (task.dueDate === dueDate && task.dueTime === dueTime) return;
      reschedule.mutate(
        { id: task.id, dueDate, dueTime },
        { onError: () => setMoveError(t("tasks.moveFailed")) },
      );
    },
    [reschedule],
  );

  if (isLoading) return <Loader />;
  if (isError) return <EmptyState title={t("tasks.loadFailed")} />;

  return (
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
        <h2 className="min-w-0 truncate text-sm font-semibold">
          {weekLabel(weekStart)}
        </h2>
        <Button
          type="button"
          variant="outline"
          className="ml-auto"
          onClick={() => setWeekStart(startOfWeek(now))}
        >
          {t("tasks.calendar.today")}
        </Button>
      </header>

      {moveError ? (
        <p role="alert" className="text-sm text-destructive">
          {moveError}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-card shadow-sm">
        <div className="sticky top-0 z-20 grid min-w-[980px] grid-cols-[4rem_repeat(7,minmax(8.5rem,1fr))] border-b border-border bg-card/95 backdrop-blur">
          <div className="border-r border-border" />
          {days.map((day) => (
            <div
              key={day}
              className={cn(
                "flex flex-col items-center justify-center border-r border-border px-3 py-2 text-center last:border-r-0",
                day === now && "bg-primary/5",
              )}
            >
              <div className="truncate text-xs font-medium text-muted-foreground">
                {weekdayName(day)}
              </div>
              <div
                className={cn(
                  "text-2xl font-semibold leading-tight",
                  day === now && "text-primary",
                )}
              >
                {dayAndMonth(day).replace(/\s.*$/, "")}
              </div>
            </div>
          ))}
        </div>

        <div
          className="grid min-w-[980px] grid-cols-[4rem_repeat(7,minmax(8.5rem,1fr))]"
          style={{ minHeight: HOURS_PER_DAY * CALENDAR_HOUR_HEIGHT }}
          data-calendar-days
        >
          <div className="relative border-r border-border bg-muted/20">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 border-t border-border/70 px-2 pt-1 text-[11px] text-muted-foreground"
                style={{
                  top: hour * CALENDAR_HOUR_HEIGHT,
                  height: CALENDAR_HOUR_HEIGHT,
                }}
              >
                {String((hour + CALENDAR_START_HOUR) % HOURS_PER_DAY).padStart(2, "0")}
                <sup className="ml-0.5 text-[9px]">00</sup>
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayTasks = tasksOfDay(board, day);
            const timed = dayTasks.filter((task) => task.dueTime !== null);
            const untimed = dayTasks.filter((task) => task.dueTime === null);

            return (
              <section
                key={day}
                role="group"
                aria-label={dayTitle(day)}
                data-testid={`calendar-day-${day}`}
                data-today={day === now ? "true" : undefined}
                data-calendar-day={day}
                className={cn(
                  "relative border-r border-border last:border-r-0",
                  day === now && "bg-primary/5",
                )}
              >
                <div className="relative h-full" data-calendar-column={day}>
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-border/70"
                      style={{
                        top: hour * CALENDAR_HOUR_HEIGHT,
                        height: CALENDAR_HOUR_HEIGHT,
                      }}
                    />
                  ))}
                  {timed.map((task) => (
                    <CalendarTaskEvent
                      key={task.id}
                      task={task}
                      draggable={draggable}
                      floating
                      project={
                        task.projectId
                          ? projectById.get(task.projectId)
                          : undefined
                      }
                      campaignName={
                        task.campaignId
                          ? campaignNameById.get(task.campaignId)
                          : undefined
                      }
                      assignee={
                        task.assigneeId
                          ? memberById.get(task.assigneeId)
                          : undefined
                      }
                      onOpen={onOpen}
                      onDrop={rescheduleTask}
                      onComplete={
                        draggable && task.repeatEvery !== "NONE"
                          ? (held) =>
                              complete.mutate(held.id, {
                                onError: () =>
                                  setMoveError(t("tasks.completeFailed")),
                              })
                          : undefined
                      }
                    />
                  ))}
                </div>

                <div className="absolute inset-x-0 top-0 z-10 space-y-1 p-1.5">
                  {untimed.map((task) => (
                    <CalendarTaskEvent
                      key={task.id}
                      task={task}
                      draggable={draggable}
                      floating={false}
                      project={
                        task.projectId
                          ? projectById.get(task.projectId)
                          : undefined
                      }
                      campaignName={
                        task.campaignId
                          ? campaignNameById.get(task.campaignId)
                          : undefined
                      }
                      assignee={
                        task.assigneeId
                          ? memberById.get(task.assigneeId)
                          : undefined
                      }
                      onOpen={onOpen}
                      onDrop={rescheduleTask}
                      onComplete={
                        draggable && task.repeatEvery !== "NONE"
                          ? (held) =>
                              complete.mutate(held.id, {
                                onError: () =>
                                  setMoveError(t("tasks.completeFailed")),
                              })
                          : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface CalendarTaskEventProps {
  task: Task;
  draggable: boolean;
  floating: boolean;
  project?: Project;
  campaignName?: string;
  assignee?: Membership;
  onOpen?: (task: Task) => void;
  onDrop: (task: Task, dueDate: string, dueTime: string) => void;
  onComplete?: (task: Task) => void;
}

function CalendarTaskEvent({
  task,
  draggable,
  floating,
  project,
  campaignName,
  assignee,
  onOpen,
  onDrop,
  onComplete,
}: CalendarTaskEventProps) {
  const eventRef = useRef<HTMLElement | null>(null);
  const pointerOffsetRef = useRef(0);
  const dragTopRef = useRef<number | null>(null);
  const initialTopRef = useRef(0);
  const isDraggingRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const columnRef = useRef<HTMLElement | null>(null);
  const ghostRef = useRef<HTMLElement | null>(null);
  const columnsRef = useRef<HTMLElement[]>([]);
  const currentDayRef = useRef(task.dueDate);

  const top = topOfTime(task.dueTime) ?? 0;

  const cleanupDrag = useCallback(
    (finalTop?: number) => {
      const ghost = ghostRef.current;
      if (ghost?.parentElement) ghost.parentElement.removeChild(ghost);
      ghostRef.current = null;

      const element = eventRef.current;
      if (element) {
        element.style.visibility = "";
        element.style.pointerEvents = "";
        element.style.opacity = "";
        element.style.cursor = draggable ? "grab" : "";
        if (floating)
          element.style.top = `${typeof finalTop === "number" ? finalTop : top}px`;
      }
      document.body.style.cursor = "";
      pointerOffsetRef.current = 0;
      dragTopRef.current = null;
      initialTopRef.current = 0;
      isDraggingRef.current = false;
      hasDraggedRef.current = false;
      columnRef.current = null;
      columnsRef.current = [];
      currentDayRef.current = task.dueDate;
    },
    [draggable, floating, task.dueDate, top],
  );

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDraggingRef.current) return;

    let targetColumn = columnRef.current;
    for (const candidate of columnsRef.current) {
      const rect = candidate.getBoundingClientRect();
      if (event.clientX >= rect.left && event.clientX <= rect.right) {
        targetColumn = candidate;
        break;
      }
      if (event.clientX > rect.right) targetColumn = candidate;
    }

    if (targetColumn && targetColumn !== columnRef.current) {
      columnRef.current = targetColumn;
      currentDayRef.current =
        targetColumn.dataset.calendarColumn ?? currentDayRef.current;
      const ghost = ghostRef.current;
      if (ghost && ghost.parentElement !== targetColumn)
        targetColumn.appendChild(ghost);
      hasDraggedRef.current = true;
    }

    const activeColumn = columnRef.current;
    if (!activeColumn) return;

    const rect = activeColumn.getBoundingClientRect();
    const rawTop = event.clientY - rect.top - pointerOffsetRef.current;
    const eventHeight =
      ghostRef.current?.offsetHeight ?? eventRef.current?.offsetHeight ?? EVENT_HEIGHT;
    const maxTop = Math.max(rect.height - eventHeight, 0);
    const minutes = minutesFromTop(Math.min(Math.max(rawTop, 0), maxTop));
    const snappedTop = topOfTime(timeOfMinutes(minutes)) ?? 0;

    if (
      Math.abs(snappedTop - initialTopRef.current) > 2 &&
      !hasDraggedRef.current
    )
      hasDraggedRef.current = true;

    dragTopRef.current = snappedTop;
    const ghost = ghostRef.current;
    if (ghost) ghost.style.top = `${snappedTop}px`;
  }, []);

  const finalizeDrop = useCallback(() => {
    const targetTop = dragTopRef.current ?? top;
    if (!hasDraggedRef.current) {
      cleanupDrag(top);
      onOpen?.(task);
      return;
    }

    const dueDate = currentDayRef.current;
    if (!dueDate) {
      cleanupDrag(top);
      return;
    }

    const dueTime = timeOfMinutes(minutesFromTop(targetTop));
    cleanupDrag(targetTop);
    onDrop(task, dueDate, dueTime);
  }, [cleanupDrag, onDrop, onOpen, task, top]);

  const handleMouseUp = useCallback(() => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    if (!isDraggingRef.current) return;
    finalizeDrop();
  }, [finalizeDrop, handleMouseMove]);

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      if ((event.target as HTMLElement).closest("button")) return;

      if (!draggable) {
        onOpen?.(task);
        return;
      }

      const element = eventRef.current;
      const dayElement = element?.closest<HTMLElement>("[data-calendar-day]");
      const daysElement = element?.closest<HTMLElement>("[data-calendar-days]");
      const columns = Array.from(
        daysElement?.querySelectorAll<HTMLElement>("[data-calendar-column]") ??
          [],
      );
      const sourceColumn = dayElement?.querySelector<HTMLElement>(
        "[data-calendar-column]",
      );
      if (!element || !sourceColumn || columns.length === 0) return;

      event.preventDefault();
      const rect = element.getBoundingClientRect();
      pointerOffsetRef.current = floating
        ? event.clientY - rect.top
        : EVENT_HEIGHT / 2;
      initialTopRef.current = floating ? top : 0;
      dragTopRef.current = floating ? top : 0;
      columnRef.current = sourceColumn;
      columnsRef.current = columns;
      currentDayRef.current = dayElement?.dataset.calendarDay ?? task.dueDate;

      const ghost = element.cloneNode(true) as HTMLElement;
      ghost.dataset.calendarGhost = "true";
      ghost.style.position = "absolute";
      ghost.style.left = "6px";
      ghost.style.right = "6px";
      ghost.style.top = `${floating ? top : 0}px`;
      ghost.style.width = "auto";
      ghost.style.pointerEvents = "none";
      ghost.style.opacity = "0.85";
      ghost.style.zIndex = "40";
      ghostRef.current = ghost;
      sourceColumn.appendChild(ghost);

      element.style.visibility = "hidden";
      element.style.pointerEvents = "none";
      element.style.opacity = "0.4";
      document.body.style.cursor = "grabbing";

      hasDraggedRef.current = false;
      isDraggingRef.current = true;
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [draggable, floating, handleMouseMove, handleMouseUp, onOpen, task, top],
  );

  useEffect(
    () => () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      cleanupDrag();
    },
    [cleanupDrag, handleMouseMove, handleMouseUp],
  );

  const ticked = task.checklist.filter((item) => item.done).length;
  const attachments = task.imageIds.length;

  return (
    <article
      ref={eventRef}
      role="button"
      tabIndex={0}
      aria-label={`${t("tasks.open")}: ${task.title}`}
      data-testid={`task-card-${task.id}`}
      data-draggable={draggable ? "true" : undefined}
      onMouseDown={handleMouseDown}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpen?.(task);
      }}
      className={cn(
        "group rounded-lg border border-border bg-card text-left shadow-sm",
        "transition-all hover:border-border hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        floating
          ? "absolute left-1.5 right-1.5 z-10 min-h-[76px] py-2 pl-4 pr-2"
          : "relative py-2 pl-4 pr-2",
      )}
      style={floating ? { top, minHeight: EVENT_HEIGHT } : undefined}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          PRIORITY_BAR[task.priority],
        )}
      />
      <div className="flex min-w-0 items-start justify-between gap-2">
        <h3 className="min-w-0 line-clamp-2 text-xs font-medium leading-snug">
          {task.title}
        </h3>
        {onComplete ? (
          <button
            type="button"
            aria-label={t("tasks.complete")}
            title={t("tasks.complete")}
            className={cn(
              "shrink-0 rounded-md p-1 text-muted-foreground transition-colors",
              "hover:bg-emerald-100 hover:text-emerald-700",
              "dark:hover:bg-emerald-950 dark:hover:text-emerald-300",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            onClick={(event) => {
              event.stopPropagation();
              onComplete(task);
            }}
          >
            <Check aria-hidden className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarClock aria-hidden className="size-3" />
          {task.dueTime ?? t("tasks.form.noTime")}
          {task.repeatEvery === "NONE" ? null : (
            <Repeat
              aria-hidden={false}
              aria-label={t("tasks.repeats")}
              className="size-3"
            />
          )}
        </span>
        {task.checklist.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            <ListChecks aria-hidden className="size-3" />
            {`${ticked}/${task.checklist.length}`}
          </span>
        ) : null}
        {attachments > 0 ? (
          <span
            className="inline-flex items-center gap-1"
            aria-label={`${t("tasks.attachments.count")}: ${attachments}`}
          >
            <Paperclip aria-hidden className="size-3" />
            {attachments}
          </span>
        ) : null}
      </div>

      <footer className="mt-1 flex min-w-0 items-center justify-between gap-2 border-t border-border/50 pt-1.5">
        <span className="flex min-w-0 items-center gap-1.5">
          {project ? <ProjectAvatar project={project} size="sm" /> : null}
          <span className="truncate text-[11px] text-muted-foreground">
            {project?.name ?? t("tasks.noProject")}
            {campaignName ? ` / ${campaignName}` : ""}
          </span>
        </span>
        {assignee ? <MemberAvatar member={assignee} size="sm" /> : null}
      </footer>
    </article>
  );
}
