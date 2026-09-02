import { cn } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { MemberAvatar, useMembers } from "@/entities/membership/index.js";
import type { Task } from "@/entities/task/index.js";

export interface TaskListProps {
  title: string;
  tasks: Task[];
  /** Left out where the list is only there to be read. A row that looks
   * clickable and is not is worse than one that never offered. */
  onOpen?: (task: Task) => void;
  empty?: string;
}

const PRIORITY_TONE: Record<Task["priority"], string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  HIGH: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  URGENT: "bg-red-600 text-white dark:bg-red-700",
};

/**
 * Work, listed beside the figures it is about.
 *
 * It knows only the tasks it is given — the project screen hands it the work in
 * flight, the campaign screen hands it that campaign's — so neither screen
 * learns how the other decides what belongs.
 */
export function TaskList({ title, tasks, onOpen, empty }: TaskListProps) {
  const { data: members } = useMembers();

  const row = (task: Task) => {
    const assignee = members?.find((member) => member.id === task.assigneeId);
    return (
      <>
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{task.title}</span>
        <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {t(`tasks.column.${task.column}`)}
        </span>
        <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-xs", PRIORITY_TONE[task.priority])}>
          {t(`tasks.priority.${task.priority}`)}
        </span>
        <span className="flex w-6 shrink-0 justify-end">
          {assignee ? <MemberAvatar member={assignee} size="sm" /> : null}
        </span>
      </>
    );
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {tasks.length === 0 ? (
        <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          {empty ?? t("tasks.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {tasks.map((task) => (
            <li key={task.id}>
              {onOpen == null ? (
                <span className="flex items-center gap-3 p-3">{row(task)}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpen(task)}
                  className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {row(task)}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
