import { useState } from "react";
import { AddTile } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { useMembers } from "@/entities/membership/index.js";
import { useProjects } from "@/entities/project/index.js";
import { participantsOf, type Task } from "@/entities/task/index.js";
import { useCan } from "@/features/permissions/index.js";
import { TaskCardView, useDoneToggle } from "@/features/task-management/index.js";

export interface TaskListProps {
  title: string;
  tasks: Task[];
  onOpen?: (task: Task) => void;
  onCreate?: () => void;
  empty?: string;
}

export function TaskList({ title, tasks, onOpen, onCreate, empty }: TaskListProps) {
  const { data: members } = useMembers();
  const { data: projects } = useProjects();
  const updatable = useCan("update", "task");
  const [failure, setFailure] = useState<string | null>(null);
  const toggleDone = useDoneToggle(setFailure);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {failure ? <p role="alert" className="text-sm text-destructive">{failure}</p> : null}
      {tasks.length === 0 && onCreate == null ? (
        <p className="rounded-lg border border-border p-5 text-center text-sm text-muted-foreground">
          {empty ?? t("tasks.empty")}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {tasks.map((task) => (
            <li key={task.id} className="min-w-0">
              <TaskCardView
                task={task}
                project={projects?.find((project) => project.id === task.projectId)}
                people={participantsOf(task, members)}
                showColumn
                className="h-full"
                onOpen={onOpen}
                onToggleDone={updatable
                  ? (held) => { setFailure(null); toggleDone(held); }
                  : undefined}
              />
            </li>
          ))}
          {onCreate != null && (
            <li className="min-w-0">
              <AddTile label={t("tasks.create")} onClick={onCreate} className="h-full" />
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
