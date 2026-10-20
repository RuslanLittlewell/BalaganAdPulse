import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Paperclip,
  Phone,
  Repeat,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  occurrencesBetween,
  participantsOf,
  timeRange,
  useRescheduleTask,
  type Task,
} from "@/entities/task/index.js";
import {
  useMembers,
  type Membership,
} from "@/entities/membership/index.js";
import {
  useProjects,
  ProjectAvatar,
  type Project,
} from "@/entities/project/index.js";
import { useAuth } from "@/features/auth/index.js";
import { useCan } from "@/features/permissions/index.js";
import { TaskDoneCheck, TaskParticipants, useDoneToggle } from "@/features/task-management/index.js";
import { t } from "@/shared/config/index.js";
import { cn, useModuleMemory, useNow } from "@/shared/lib/index.js";
import WarmTooltip, { WarmTooltipGroup } from "@/shared/ui/WarmTooltip/WarmTooltip.js";
import {
  Button,
  EmptyState,
  Loader,
  toIso,
} from "@/shared/ui/index.js";
import {
  CALENDAR_HOUR_HEIGHT,
  CALENDAR_START_HOUR,
  HOURS_PER_DAY,
  MINUTES_PER_HOUR,
  dayAndMonth,
  dayTitle,
  layoutDay,
  minutesFromTop,
  startKeepingWithinDay,
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
const SHORTEST_EVENT = 18;
const HOURS = Array.from({ length: HOURS_PER_DAY }, (_, hour) => hour);
const ZOOM_LEVELS = 5;
const LARGEST_ZOOM = ZOOM_LEVELS - 1;
const SMALLEST_HOUR_HEIGHT = 16;
const COMPACT_BELOW = 40;

function isZoomLevel(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= LARGEST_ZOOM;
}

function hourHeightAt(level: number, fittingHourHeight: number): number {
  const smallest = Math.min(CALENDAR_HOUR_HEIGHT, fittingHourHeight);
  return smallest + ((CALENDAR_HOUR_HEIGHT - smallest) * level) / LARGEST_ZOOM;
}

const PRIORITY_BAR: Record<Task["priority"], string> = {
  LOW: "bg-border",
  MEDIUM: "bg-sky-400",
  HIGH: "bg-amber-400",
  URGENT: "bg-red-500",
};

function recursOn(task: Task, day: string): boolean {
  return task.isCall && task.dueDate !== day && occurrencesBetween(task, day, day).length > 0;
}

function timeOfDay(moment: Date): string {
  return `${String(moment.getHours()).padStart(2, "0")}:${String(moment.getMinutes()).padStart(2, "0")}`;
}

function NowLine({ time, hourHeight }: { time: string; hourHeight: number }) {
  return (
    <div
      aria-hidden
      data-testid="calendar-now"
      data-now={time}
      className="pointer-events-none absolute inset-x-0 z-15 border-t-2 border-primary"
      style={{ top: topOfTime(time, hourHeight) ?? 0 }}
    >
      <span className="absolute left-[-5px] top-[-6px] size-2.5 rounded-full bg-primary" />
    </div>
  );
}

export function TaskCalendar({
  tasks,
  isLoading,
  isError,
  today,
  onOpen,
}: TaskCalendarProps) {
  const clock = useNow();
  const now = today ?? toIso(clock);
  const reschedule = useRescheduleTask();
  const draggable = useCan("update", "task");
  const { data: projects } = useProjects();
  const { data: members } = useMembers();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(now));
  const [moveError, setMoveError] = useState<string | null>(null);
  const toggleDone = useDoneToggle(setMoveError);
  const toggleTask = useCallback((task: Task) => {
    setMoveError(null);
    toggleDone(task);
  }, [toggleDone]);

  const { user } = useAuth();
  const rememberedZoom = useModuleMemory((state) => (user ? state.taskCalendarZooms[user.id] : undefined));
  const rememberZoom = useModuleMemory((state) => state.rememberTaskCalendarZoom);
  const [chosenZoom, setChosenZoom] = useState<number | null>(null);
  const zoom = chosenZoom ?? (isZoomLevel(Number(rememberedZoom)) ? Number(rememberedZoom) : LARGEST_ZOOM);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [heading, setHeading] = useState<HTMLDivElement | null>(null);
  const [fittingHourHeight, setFittingHourHeight] = useState(SMALLEST_HOUR_HEIGHT);

  useLayoutEffect(() => {
    if (!scroller) return undefined;
    const measure = () => {
      const visible = scroller.clientHeight - (heading?.offsetHeight ?? 0);
      setFittingHourHeight(visible > 0 ? Math.max(SMALLEST_HOUR_HEIGHT, visible / HOURS_PER_DAY) : SMALLEST_HOUR_HEIGHT);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [scroller, heading]);

  const hourHeight = hourHeightAt(zoom, fittingHourHeight);
  const compact = hourHeight < COMPACT_BELOW;

  const changeZoom = (step: number) => {
    const next = Math.max(0, Math.min(LARGEST_ZOOM, zoom + step));
    setChosenZoom(next);
    if (user) rememberZoom(user.id, String(next));
  };

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
    <WarmTooltipGroup>
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
            size="icon"
            className="ml-auto"
            aria-label={t("tasks.calendar.zoomOut")}
            disabled={zoom === 0}
            onClick={() => changeZoom(-1)}
          >
            <ZoomOut />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("tasks.calendar.zoomIn")}
            disabled={zoom === LARGEST_ZOOM}
            onClick={() => changeZoom(1)}
          >
            <ZoomIn />
          </Button>
          <Button
            type="button"
            variant="outline"
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

        <div ref={setScroller} className="min-h-0 flex-1 overflow-auto rounded-xl border border-border glass-card shadow-sm">
          <div ref={setHeading} className="sticky top-0 z-20 grid min-w-[980px] grid-cols-[4rem_repeat(7,minmax(8.5rem,1fr))] border-b border-border bg-card/95 backdrop-blur">
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
            style={{ minHeight: HOURS_PER_DAY * hourHeight }}
            data-calendar-days
            data-testid="calendar-grid"
            data-zoom={zoom}
          >
            <div className="relative border-r border-border bg-muted/20">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-border/70 px-2 pt-1 text-[11px] text-muted-foreground"
                  style={{
                    top: hour * hourHeight,
                    height: hourHeight,
                  }}
                >
                  {String((hour + CALENDAR_START_HOUR) % HOURS_PER_DAY).padStart(2, "0")}
                  <sup className="ml-0.5 text-[9px]">00</sup>
                </div>
              ))}
            </div>

            {days.map((day) => {
              const dayTasks = [...tasksOfDay(board, day), ...board.filter((task) => recursOn(task, day))];
              const timed = layoutDay(dayTasks.filter((task) => task.dueTime !== null));
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
                          top: hour * hourHeight,
                          height: hourHeight,
                        }}
                      />
                    ))}
                    {timed.map(({ task, start, end, lane, lanes }) => (
                      <CalendarTaskEvent
                        key={task.id}
                        task={task}
                        draggable={draggable && task.dueDate === day}
                        floating
                        span={{ start, end, lane, lanes }}
                        hourHeight={hourHeight}
                        compact={compact}
                        project={
                          task.projectId
                            ? projectById.get(task.projectId)
                            : undefined
                        }
                        people={participantsOf(task, memberById)}
                        onOpen={onOpen}
                        onDrop={rescheduleTask}
                        onToggleDone={draggable && !task.isCall ? toggleTask : undefined}
                      />
                    ))}
                    {day === now ? <NowLine time={timeOfDay(clock)} hourHeight={hourHeight} /> : null}
                  </div>

                  <div className="absolute inset-x-0 top-0 z-10 space-y-1 p-1.5">
                    {untimed.map((task) => (
                      <CalendarTaskEvent
                        key={task.id}
                        task={task}
                        draggable={draggable}
                        floating={false}
                        hourHeight={hourHeight}
                        compact={compact}
                        project={
                          task.projectId
                            ? projectById.get(task.projectId)
                            : undefined
                        }
                        people={participantsOf(task, memberById)}
                        onOpen={onOpen}
                        onDrop={rescheduleTask}
                        onToggleDone={draggable ? toggleTask : undefined}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </WarmTooltipGroup>
  );
}

interface EventSpan {
  start: number;
  end: number;
  lane: number;
  lanes: number;
}

interface CalendarTaskEventProps {
  task: Task;
  draggable: boolean;
  floating: boolean;
  span?: EventSpan;
  hourHeight: number;
  compact: boolean;
  project?: Project;
  people: readonly Membership[];
  onOpen?: (task: Task) => void;
  onDrop: (task: Task, dueDate: string, dueTime: string) => void;
  onToggleDone?: (task: Task) => void;
}

function CalendarTaskEvent({
  task,
  draggable,
  floating,
  span,
  hourHeight,
  compact: gridCompact,
  project,
  people,
  onOpen,
  onDrop,
  onToggleDone,
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
  const listenersRef = useRef<{ move: (event: MouseEvent) => void; up: () => void } | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const top = topOfTime(task.dueTime, hourHeight) ?? 0;
  const drawnHeight = span
    ? Math.max(
        Math.min(((span.end - span.start) / MINUTES_PER_HOUR) * hourHeight, HOURS_PER_DAY * hourHeight - top) - 2,
        SHORTEST_EVENT,
      )
    : null;
  const compact = drawnHeight === null ? gridCompact : drawnHeight < EVENT_HEIGHT;
  const eventHeight = drawnHeight ?? (compact ? Math.max(hourHeight - 2, SHORTEST_EVENT) : EVENT_HEIGHT);

  const cleanupDrag = useCallback(
    (finalTop?: number) => {
      const ghost = ghostRef.current;
      if (ghost?.parentElement) ghost.parentElement.removeChild(ghost);
      ghostRef.current = null;

      const element = eventRef.current;
      if (element) {
        element.style.transition = "none";
        element.style.visibility = "";
        element.style.pointerEvents = "";
        element.style.opacity = "";
        element.style.cursor = draggable ? "grab" : "";
        if (floating)
          element.style.top = `${typeof finalTop === "number" ? finalTop : top}px`;
        requestAnimationFrame(() => {
          element.style.transition = "";
        });
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
    const heldHeight =
      ghostRef.current?.offsetHeight ?? eventRef.current?.offsetHeight ?? eventHeight;
    const maxTop = Math.max(rect.height - heldHeight, 0);
    const minutes = minutesFromTop(Math.min(Math.max(rawTop, 0), maxTop), hourHeight);
    const snappedTop = topOfTime(timeOfMinutes(minutes), hourHeight) ?? 0;

    if (
      Math.abs(snappedTop - initialTopRef.current) > 2 &&
      !hasDraggedRef.current
    )
      hasDraggedRef.current = true;

    dragTopRef.current = snappedTop;
    const ghost = ghostRef.current;
    if (ghost) ghost.style.top = `${snappedTop}px`;
  }, [eventHeight, hourHeight]);

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

    const dueTime = timeOfMinutes(startKeepingWithinDay(task, minutesFromTop(targetTop, hourHeight)));
    const settledTop = topOfTime(dueTime, hourHeight) ?? targetTop;
    if (dueDate !== task.dueDate) {
      if (ghostRef.current) ghostRef.current.style.opacity = "1";
      document.body.style.cursor = "";
      isDraggingRef.current = false;
      hasDraggedRef.current = false;
      settleTimerRef.current = setTimeout(() => cleanupDrag(top), 1000);
    } else {
      cleanupDrag(settledTop);
    }
    onDrop(task, dueDate, dueTime);
  }, [cleanupDrag, hourHeight, onDrop, onOpen, task, top]);

  const handleMouseUp = useCallback(() => {
    const listeners = listenersRef.current;
    if (listeners) {
      document.removeEventListener("mousemove", listeners.move);
      document.removeEventListener("mouseup", listeners.up);
      listenersRef.current = null;
    }
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
        : eventHeight / 2;
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
      ghost.style.transition = "none";
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
      listenersRef.current = { move: handleMouseMove, up: handleMouseUp };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [draggable, eventHeight, floating, handleMouseMove, handleMouseUp, onOpen, task, top],
  );

  useEffect(
    () => () => {
      const listeners = listenersRef.current;
      if (listeners) {
        document.removeEventListener("mousemove", listeners.move);
        document.removeEventListener("mouseup", listeners.up);
      }
      clearTimeout(settleTimerRef.current);
      const ghost = ghostRef.current;
      if (ghost?.parentElement) ghost.parentElement.removeChild(ghost);
      if (isDraggingRef.current) document.body.style.cursor = "";
    },
    [],
  );

  const ticked = task.checklist.filter((item) => item.done).length;
  const attachments = task.imageIds.length;
  const placement: CSSProperties | undefined = floating
    ? {
        top,
        height: eventHeight,
        left: `calc(6px + (100% - 12px) * ${(span?.lane ?? 0) / (span?.lanes ?? 1)})`,
        width: `calc((100% - 12px) / ${span?.lanes ?? 1} - 2px)`,
      }
    : undefined;

  const card = (
    <article
      ref={eventRef}
      role="button"
      tabIndex={0}
      aria-label={`${t("tasks.open")}: ${task.title}`}
      data-testid={`task-card-${task.id}`}
      data-draggable={draggable ? "true" : undefined}
      data-compact={compact ? "true" : undefined}
      data-lane={span ? span.lane : undefined}
      data-lanes={span ? span.lanes : undefined}
      onMouseDown={handleMouseDown}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpen?.(task);
      }}
      className={cn(
        "group rounded-lg border border-border glass-card text-left shadow-sm",
        "transition-all hover:border-border hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        compact ? "relative h-full w-full" : floating ? "absolute z-10" : "relative",
        compact ? "overflow-hidden py-0.5 pl-3 pr-1.5" : "flex flex-col overflow-hidden py-2 pl-4 pr-2",
      )}
      style={compact ? undefined : placement}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          PRIORITY_BAR[task.priority],
        )}
      />
      {compact ? (
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] leading-tight">
          {onToggleDone ? <TaskDoneCheck task={task} size={11} onToggle={onToggleDone} /> : null}
          <h3 className="min-w-0 truncate font-medium">{task.title}</h3>
          <span className="shrink-0 text-muted-foreground">{timeRange(task) ?? t("tasks.form.noTime")}</span>
        </div>
      ) : (
        <>
        <div className="flex min-h-0 min-w-0 shrink items-start gap-1.5 overflow-hidden">
          {onToggleDone ? <TaskDoneCheck task={task} size={14} onToggle={onToggleDone} /> : null}
          <h3 className="min-w-0 line-clamp-2 text-xs font-medium leading-snug">
            {task.title}
          </h3>
        </div>

        <div className="mb-1 mt-1 flex min-h-0 min-w-0 shrink flex-wrap items-center gap-1 overflow-hidden text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarClock aria-hidden className="size-3" />
            {timeRange(task) ?? t("tasks.form.noTime")}
            {task.repeatEvery === "NONE" ? null : (
              <Repeat
                aria-hidden={false}
                aria-label={t("tasks.repeats")}
                className="size-3"
              />
            )}
            {task.isCall ? <Phone aria-hidden={false} aria-label={t("tasks.call")} className="size-3" /> : null}
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

        <footer className="mt-auto flex min-w-0 shrink-0 items-center justify-between gap-2 border-t border-border/50 pt-1.5">
          <span className="flex min-w-0 items-center gap-1.5">
            {project ? <ProjectAvatar project={project} size="sm" /> : null}
            <span className="truncate text-[11px] text-muted-foreground">
              {project?.name ?? t("tasks.noProject")}
            </span>
          </span>
          <TaskParticipants task={task} people={people} />
        </footer>
        </>
      )}
    </article>
  );

  if (!compact) return card;

  return (
    <WarmTooltip
      side="right"
      style={floating ? { ...placement, position: "absolute", zIndex: 10 } : { display: "flex", width: "100%" }}
      content={
        <span className="flex max-w-64 flex-col gap-0.5 text-left">
          <span className="font-medium">{task.title}</span>
          <span>{timeRange(task) ?? t("tasks.form.noTime")}</span>
          {project ? <span>{project.name}</span> : null}
          {people.length > 0 ? <span>{people.map((member) => member.name).join(", ")}</span> : null}
        </span>
      }
    >
      {card}
    </WarmTooltip>
  );
}
