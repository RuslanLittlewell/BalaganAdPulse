import type React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Paperclip } from "lucide-react";
import type { Task } from "@/entities/task/index.js";
import { MemberAvatar, type Membership } from "@/entities/membership/index.js";
import { ProjectAvatar, type Project } from "@/entities/project/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";

export interface TaskCardProps {
  task: Task;
  draggable: boolean;
  placeholder?: boolean;
  project?: Project;
  /** The name of the campaign the task names. Absent means the task names none,
   * which the card states as Общий rather than leaving blank. */
  campaignName?: string;
  assignee?: Membership;
  onOpen?: (task: Task) => void;
}

/** The badge in the corner. Muted for the ordinary levels so that URGENT is the
 * only thing that pulls the eye across a full column. */
const PRIORITY_TONE: Record<Task["priority"], string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  HIGH: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  URGENT: "bg-red-600 text-white dark:bg-red-700",
};

/** The same four levels down the card's left edge, so priority is legible even
 * where the badge is clipped by a narrow column. */
const PRIORITY_BAR: Record<Task["priority"], string> = {
  LOW: "bg-border",
  MEDIUM: "bg-sky-400",
  HIGH: "bg-amber-400",
  URGENT: "bg-red-500",
};

export function TaskCard({
  task, draggable, placeholder = false, project, campaignName, assignee, onOpen,
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
        "group relative shrink-0 overflow-hidden rounded-xl border border-border bg-card",
        // The left padding is the gutter: it holds the priority bar, and the
        // drag handle appears over it. Reserved on every card, dragged or not,
        // so text never reflows as the pointer crosses.
        "py-3 pl-5 pr-3 text-left",
        "shadow-sm transition-all hover:border-border hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
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
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1.5 transition-opacity group-hover:opacity-0",
          PRIORITY_BAR[task.priority],
        )}
      />

      {draggable ? (
        <button
          type="button"
          aria-label={t("tasks.drag")}
          data-testid={`task-drag-${task.id}`}
          className={cn(
            "absolute inset-y-0 left-0 grid w-5 place-items-center text-muted-foreground",
            "opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 group-hover:opacity-100",
          )}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={onHandleKeyDown}
          {...attributes}
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
      ) : null}

      <div
        className="flex items-start justify-between gap-2"
        data-testid={`task-header-${task.id}`}
      >
        <h3 className="min-w-0 line-clamp-3 text-sm font-medium leading-snug">{task.title}</h3>
        <span
          data-testid={`task-priority-${task.id}`}
          data-priority={task.priority}
          className={cn(
            "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight",
            PRIORITY_TONE[task.priority],
          )}
        >
          {t(`tasks.priority.${task.priority}`)}
        </span>
      </div>

      {attachments > 0 ? (
        <div className="mt-2">
          <span
            className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
            data-testid={`task-attachments-${task.id}`}
            aria-label={`${t("tasks.attachments.count")}: ${attachments}`}
          >
            <Paperclip aria-hidden className="size-3" />
            {attachments}
          </span>
        </div>
      ) : null}

      <footer className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-1.5" data-testid={`task-project-${task.id}`}>
            {project ? <ProjectAvatar project={project} size="sm" /> : null}
            <span className="truncate text-xs text-muted-foreground">
              {project?.name ?? t("tasks.noProject")}
            </span>
          </span>
          <span
            className="truncate pt-1 pl-0.5 text-[11px] text-muted-foreground/80"
            data-testid={`task-campaign-${task.id}`}
          >
            {campaignName ?? t("tasks.form.wholeProject")}
          </span>
        </span>

        {assignee ? (
          <span
            className="flex shrink-0 items-center"
            data-testid={`task-assignee-${task.id}`}
            title={assignee.name}
          >
            <MemberAvatar member={assignee} size="sm" />
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
