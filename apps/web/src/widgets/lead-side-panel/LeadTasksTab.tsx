import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { useCan } from "@/features/permissions/index.js";
import { TaskDialogs, type OpenedTask } from "@/features/task-management/index.js";
import { LeadTaskList } from "@/widgets/lead-task-list/index.js";
import type { Lead } from "@/entities/lead/index.js";
import type { Task } from "@/entities/task/index.js";

export interface LeadTasksTabProps {
  lead: Pick<Lead, "id" | "name" | "projectId">;
  tasks: readonly Task[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function LeadTasksTab({ lead, tasks, isLoading, isError }: LeadTasksTabProps) {
  const [opened, setOpened] = useState<OpenedTask>({ mode: "closed" });
  const mayCreate = useCan("create", "task");

  return (
    <div className="flex flex-col gap-3">
      {mayCreate ? (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpened({ mode: "create", lead: { id: lead.id, name: lead.name, projectId: lead.projectId } })}
          >
            <PlusIcon aria-hidden className="size-3" />
            {t("tasks.create")}
          </Button>
        </div>
      ) : null}
      <LeadTaskList
        tasks={tasks}
        isLoading={isLoading}
        isError={isError}
        empty={t("crm.tasks.empty")}
        onOpen={(task) => setOpened({ mode: "open", task })}
      />
      <TaskDialogs opened={opened} onClose={() => setOpened({ mode: "closed" })} />
    </div>
  );
}
