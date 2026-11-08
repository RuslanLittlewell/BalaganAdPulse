import { useId } from "react";
import { Link } from "react-router-dom";
import { CircleCheck } from "lucide-react";
import { endShownAs, type DueTask, type DueWhen, type Task } from "@/entities/task/index.js";
import { t } from "@/shared/config/index.js";
import { formatDay, ROUTES } from "@/shared/lib/index.js";
import { cn } from "@/shared/lib/utils.js";
import { Button, Loader } from "@/shared/ui/index.js";
import { useAuth } from "@/features/auth/index.js";
import { useDueTasks } from "./useDueTasks.js";

const TONE: Record<DueWhen, string> = {
  overdue: "text-red-600 dark:text-red-400",
  today: "text-amber-600 dark:text-amber-400",
  tomorrow: "text-muted-foreground",
  soon: "text-muted-foreground",
};

const PRIORITY_MARKER: Record<Task["priority"], string> = {
  LOW: "bg-border",
  MEDIUM: "bg-sky-400",
  HIGH: "bg-amber-400",
  URGENT: "bg-red-500",
};

function labelOf({ task, day, when }: DueTask): string {
  const time = task.dueTime && task.endTime ? ` ${t("dashboard.due.until")} ${endShownAs(task.endTime)}` : "";
  if (when === "overdue") return `${t("dashboard.due.overdue")} ${formatDay(day)}${time}`;
  if (when === "today") return `${t("dashboard.due.today")}${time}`;
  return `${when === "tomorrow" ? t("dashboard.due.tomorrow") : formatDay(day)}${time}`;
}

export function DueTasks() {
  return useAuth().modules.includes("TASKS") ? <DueTasksBlock /> : null;
}

function DueTasksBlock() {
  const titleId = useId();
  const { due, isPending, isError, retry } = useDueTasks();

  return (
    <section aria-labelledby={titleId} className="flex min-h-0 max-h-[340px] flex-col gap-2 overflow-y-auto rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id={titleId} className="text-sm font-semibold text-foreground">{t("dashboard.due.title")}</h2>
        {due.length > 0 ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium tabular-nums text-primary">
            <span className="sr-only">{t("dashboard.due.count")} </span>
            {due.length}
          </span>
        ) : null}
      </div>
      {isPending ? (
        <Loader label={t("dashboard.due.loading")} size="sm" />
      ) : isError ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-xs text-destructive">{t("dashboard.due.error")}</p>
          <Button variant="outline" size="sm" onClick={retry}>{t("state.retry")}</Button>
        </div>
      ) : due.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheck aria-hidden="true" className="size-3 shrink-0 text-emerald-600" />
          {t("dashboard.due.none")}
        </p>
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {due.map((entry) => (
            <li key={entry.task.id}>
              <Link
                to={`${ROUTES.tasks}?task=${entry.task.id}`}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  aria-hidden="true"
                  data-priority={entry.task.priority}
                  title={t(`tasks.priority.${entry.task.priority}`)}
                  className={cn("h-5 w-1 shrink-0 rounded-full", PRIORITY_MARKER[entry.task.priority])}
                />
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  <span className="sr-only">{t(`tasks.priority.${entry.task.priority}`)}. </span>
                  {entry.task.title}
                </span>
                <span className={cn("shrink-0 text-xs tabular-nums", TONE[entry.when])} data-when={entry.when}>
                  {labelOf(entry)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
