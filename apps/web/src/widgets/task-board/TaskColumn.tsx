import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import type { Task, TaskColumn as Column } from "@/entities/task/index.js";
import type { Membership } from "@/entities/membership/index.js";
import type { Project } from "@/entities/project/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import { TaskCard } from "./TaskCard.js";

export interface TaskColumnProps {
  column: Column;
  tasks: Task[];
  draggable: boolean;
  draggingId?: string | null;
  projects?: Map<string, Project>;
  members?: Map<string, Membership>;
  onOpen?: (task: Task) => void;
}

const ACCENT: Record<Column, string> = {
  IDEA: "bg-slate-400",
  ARCHIVED: "bg-zinc-400",
  IN_PROGRESS: "bg-sky-500",
  NEEDS_FIX: "bg-amber-500",
  IN_REVIEW: "bg-violet-500",
  DONE: "bg-emerald-500",
};

export function TaskColumnPanel({
  column, tasks, draggable, draggingId, projects, members, onOpen,
}: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column });

  return (
    <section
      ref={setNodeRef}
      aria-label={t(`tasks.column.${column}`)}
      data-testid={`task-column-${column}`}
      className={cn(
        "flex h-full min-h-0 w-80 shrink-0 flex-col rounded-xl border border-border",
        "bg-muted/30 shadow-sm transition-colors",
        isOver && "border-primary/40 bg-primary/5 shadow-md",
      )}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border/70 px-3 py-2.5">
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", ACCENT[column])} />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
          {t(`tasks.column.${column}`)}
        </h2>
        <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border">
          {tasks.length}
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
              project={projects?.get(task.projectId)}
              assignee={task.assigneeId ? members?.get(task.assigneeId) : undefined}
              onOpen={onOpen}
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
