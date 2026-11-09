import { useMemo } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { useCan } from "@/features/permissions/index.js";
import { TaskDialogs, useTaskAddress } from "@/features/task-management/index.js";
import { DEFAULT_VIEW, visibleLeads, type ViewState } from "@/features/lead-view-options/index.js";
import { TaskCalendar } from "@/widgets/task-calendar/index.js";
import { useLeads, type Lead, type LeadField } from "@/entities/lead/index.js";
import { useCrmTasks, useTaskEvents, type TaskLead } from "@/entities/task/index.js";

export interface CrmTasksProps {
  boardKey: string | undefined;
  view?: ViewState;
  fields: readonly LeadField[];
  onOpenLead: (lead: Lead) => void;
}

export function CrmTasks({ boardKey, view = DEFAULT_VIEW, fields, onOpenLead }: CrmTasksProps) {
  const { data: leads } = useLeads(boardKey);
  const { data: tasks, isLoading, isError } = useCrmTasks({ projectId: boardKey, enabled: boardKey !== undefined });
  const { opened, open, create, close } = useTaskAddress(tasks);
  const mayCreate = useCan("create", "task");
  useTaskEvents();

  const passing = useMemo(
    () => new Set(visibleLeads(leads ?? [], view, fields).map((lead) => lead.id)),
    [leads, view, fields],
  );
  const shown = useMemo(
    () => (tasks ?? []).filter((task) => task.leadId != null && passing.has(task.leadId)),
    [tasks, passing],
  );

  const openLead = (lead: TaskLead) => {
    const found = leads?.find((candidate) => candidate.id === lead.id);
    if (found) onOpenLead(found);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {mayCreate && boardKey ? (
        <div className="flex justify-end">
          <Button type="button" className="h-8" onClick={() => create({ leadChoice: { boardKey } })}>
            <PlusIcon aria-hidden className="size-3" />
            {t("tasks.create")}
          </Button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <TaskCalendar tasks={shown} isLoading={isLoading} isError={isError} onOpen={open} onOpenLead={openLead} />
      </div>
      <TaskDialogs opened={opened} onClose={close} />
    </div>
  );
}
