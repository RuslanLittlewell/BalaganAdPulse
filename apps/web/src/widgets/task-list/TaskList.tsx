import { cn } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { MemberAvatar, useMembers } from "@/entities/membership/index.js";
import type { Task } from "@/entities/task/index.js";

export interface TaskListProps {
  title: string;
  tasks: Task[];
  onOpen?: (task: Task) => void;
  empty?: string;
}

const PRIORITY_TONE: Record<Task["priority"], string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  HIGH: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  URGENT: "bg-red-600 text-white dark:bg-red-700",
};

export function TaskList({ title, tasks, onOpen, empty }: TaskListProps) {
  const { data: members } = useMembers();

  const card = (task: Task) => {
    const assignee = members?.find((member) => member.id === task.assigneeId);
    return (
      <>
        <span className="line-clamp-2 min-h-10 text-sm font-medium leading-5 text-foreground">{task.title}</span>
        <span className="mt-auto flex items-center gap-2 pt-3">
          <span className="truncate rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {t(`tasks.column.${task.column}`)}
          </span>
          <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-xs", PRIORITY_TONE[task.priority])}>
            {t(`tasks.priority.${task.priority}`)}
          </span>
          <span className="ml-auto flex shrink-0">
            {assignee ? <MemberAvatar member={assignee} size="sm" /> : null}
          </span>
        </span>
      </>
    );
  };

  const cardClass = "flex h-full min-h-28 w-full flex-col rounded-lg border border-border bg-card p-3 text-left shadow-sm";

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {tasks.length === 0 ? (
        <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          {empty ?? t("tasks.empty")}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {tasks.map((task) => (
            <li key={task.id} className="min-w-0">
              {onOpen == null ? (
                <span className={cardClass}>{card(task)}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpen(task)}
                  className={cn(
                    cardClass,
                    "transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring",
                  )}
                >
                  {card(task)}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
