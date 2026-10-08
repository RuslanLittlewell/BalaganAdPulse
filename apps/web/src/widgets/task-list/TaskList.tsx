import { AddTile } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { useMembers } from "@/entities/membership/index.js";
import { useProjects } from "@/entities/project/index.js";
import type { Task } from "@/entities/task/index.js";
import { TaskCardView } from "@/features/task-management/index.js";

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

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {tasks.length === 0 && onCreate == null ? (
        <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          {empty ?? t("tasks.empty")}
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3">
          {tasks.map((task) => (
            <li key={task.id} className="min-w-0">
              <TaskCardView
                task={task}
                project={projects?.find((project) => project.id === task.projectId)}
                assignee={members?.find((member) => member.id === task.assigneeId)}
                showColumn
                className="h-full"
                onOpen={onOpen}
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
