import { useMemo, useState } from "react";
import { Loader } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { useMembers } from "@/entities/membership/index.js";
import { participantsOf, tasksByDue, type Task } from "@/entities/task/index.js";
import { useCan } from "@/features/permissions/index.js";
import { TaskCardView, useDoneToggle } from "@/features/task-management/index.js";

export interface LeadTaskListProps {
  tasks: readonly Task[] | undefined;
  isLoading: boolean;
  isError: boolean;
  empty: string;
  onOpen: (task: Task) => void;
}

export function LeadTaskList({ tasks, isLoading, isError, empty, onOpen }: LeadTaskListProps) {
  const { data: members } = useMembers();
  const updatable = useCan("update", "task");
  const [failure, setFailure] = useState<string | null>(null);
  const toggleDone = useDoneToggle(setFailure);
  const ordered = useMemo(() => tasksByDue(tasks ?? [], { openFirst: true }), [tasks]);

  if (isLoading) return <Loader />;
  if (isError) return <p role="alert" className="text-sm text-destructive">{t("tasks.loadFailed")}</p>;

  return (
    <div className="flex flex-col gap-2">
      {failure ? <p role="alert" className="text-sm text-destructive">{failure}</p> : null}
      {ordered.length === 0 ? (
        <p className="rounded-lg border border-border p-5 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {ordered.map((task) => (
            <li key={task.id} className="min-w-0">
              <TaskCardView
                task={task}
                people={participantsOf(task, members)}
                showColumn
                className="h-full"
                onOpen={onOpen}
                onToggleDone={updatable ? (held) => { setFailure(null); toggleDone(held); } : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
