import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import type { Task } from "@/entities/task/index.js";
import type { Membership } from "@/entities/membership/index.js";
import type { Project } from "@/entities/project/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import { TaskCard } from "@/widgets/task-board/TaskCard.js";
import { dayAndMonth, dayTitle, weekdayName } from "./week.js";

export interface CalendarDayProps {
  day: string;
  today: boolean;
  tasks: Task[];
  draggable: boolean;
  draggingId?: string | null;
  projects?: Map<string, Project>;
  members?: Map<string, Membership>;
  onOpen?: (task: Task) => void;
  onComplete?: (task: Task) => void;
}

export function CalendarDay({
  day, today, tasks, draggable, draggingId, projects, members, onOpen, onComplete,
}: CalendarDayProps) {
  const { setNodeRef, isOver } = useDroppable({ id: day });

  return (
    <section
      ref={setNodeRef}
      role="group"
      aria-label={dayTitle(day)}
      data-testid={`calendar-day-${day}`}
      data-today={today ? "true" : undefined}
      className={cn(
        "flex h-full min-h-0 min-w-56 flex-1 flex-col rounded-xl border border-border",
        "bg-muted/30 shadow-sm transition-colors",
        today && "border-primary/50 bg-primary/5",
        isOver && "border-primary/40 bg-primary/10 shadow-md",
      )}
    >
      <header className="flex shrink-0 items-baseline gap-2 border-b border-border/70 px-3 py-2.5">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
          {weekdayName(day)}
        </h2>
        <span className={cn("shrink-0 text-xs", today ? "font-semibold text-primary" : "text-muted-foreground")}>
          {dayAndMonth(day)}
        </span>
      </header>

      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              draggable={draggable}
              placeholder={task.id === draggingId}
              project={task.projectId ? projects?.get(task.projectId) : undefined}
              assignee={task.assigneeId ? members?.get(task.assigneeId) : undefined}
              onOpen={onOpen}
              onComplete={onComplete}
            />
          ))}

          {tasks.length === 0 ? (
            <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
              {t("tasks.empty")}
            </p>
          ) : null}
        </div>
      </SortableContext>
    </section>
  );
}
