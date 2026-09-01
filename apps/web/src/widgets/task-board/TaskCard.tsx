import type React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Paperclip } from "lucide-react";
import type { Task } from "@/entities/task/index.js";
import type { Membership } from "@/entities/membership/index.js";
import { ProjectAvatar, type Project } from "@/entities/project/index.js";
import { t } from "@/shared/config/index.js";
import { Avatar } from "@/shared/ui/index.js";
import { cn } from "@/shared/lib/index.js";

export interface TaskCardProps {
  task: Task;
  draggable: boolean;
  placeholder?: boolean;
  project?: Project;
  assignee?: Membership;
  onOpen?: (task: Task) => void;
}

const PRIORITY_TONE: Record<Task["priority"], string> = {
  LOW: "bg-muted text-muted-foreground ring-border",
  MEDIUM: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-900",
  HIGH: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-900",
  URGENT: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-200 dark:ring-red-900",
};

export function TaskCard({
  task, draggable, placeholder = false, project, assignee, onOpen,
}: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id,
    disabled: !draggable,
  });
  const attachments = task.imageIds.length;

  const { onKeyDown: startKeyboardDrag, ...pointerListeners } = listeners ?? {};
  const onHandleKeyDown = startKeyboardDrag as React.KeyboardEventHandler<HTMLButtonElement> | undefined;

  function open() {
    onOpen?.(task);
  }

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group relative shrink-0 rounded-lg border border-border bg-card p-3 text-left",
        "shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        onOpen && "cursor-pointer",
        placeholder && "border-dashed opacity-40 shadow-none",
      )}
      data-testid={`task-card-${task.id}`}
      data-draggable={draggable ? "true" : undefined}
      data-placeholder={placeholder ? "true" : undefined}
      role="button"
      tabIndex={0}
      aria-label={`${t("tasks.open")}: ${task.title}`}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        open();
      }}
      {...(draggable ? pointerListeners : {})}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 font-medium leading-snug">{task.title}</h3>
        {draggable ? (
          <button
            type="button"
            aria-label={t("tasks.drag")}
            data-testid={`task-drag-${task.id}`}
            className="-mr-1 -mt-1 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 group-hover:opacity-100"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={onHandleKeyDown}
            {...attributes}
          >
            <GripVertical aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-xs ring-1 ring-inset", PRIORITY_TONE[task.priority])}>
          {t(`tasks.priority.${task.priority}`)}
        </span>
        {attachments > 0 ? (
          <span
            className="flex items-center gap-1 text-xs text-muted-foreground"
            data-testid={`task-attachments-${task.id}`}
            aria-label={`${t("tasks.attachments.count")}: ${attachments}`}
          >
            <Paperclip aria-hidden className="size-3.5" />
            {attachments}
          </span>
        ) : null}
      </div>

      <footer className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
        <span className="flex min-w-0 items-center gap-1.5" data-testid={`task-project-${task.id}`}>
          {project ? <ProjectAvatar project={project} size="sm" /> : null}
          <span className="truncate text-xs text-muted-foreground">
            {project?.name ?? t("tasks.noProject")}
          </span>
        </span>

        {assignee ? (
          <span
            className="flex shrink-0 items-center gap-1.5"
            data-testid={`task-assignee-${task.id}`}
            title={assignee.name}
          >
            {assignee.image ? (
              <img src={assignee.image} alt={assignee.name} className="size-8 shrink-0 rounded-md object-cover" />
            ) : (
              <Avatar name={assignee.name} size="sm" />
            )}
          </span>
        ) : (
          <span className="shrink-0 text-xs text-muted-foreground">
            {t("tasks.form.unassigned")}
          </span>
        )}
      </footer>
    </article>
  );
}
