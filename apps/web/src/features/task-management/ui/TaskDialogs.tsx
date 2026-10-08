import { useState } from "react";
import { ConfirmDialog } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { useCan } from "@/features/permissions/index.js";
import { useDeleteTask, type Task, type TaskColumn } from "@/entities/task/index.js";
import { TaskFormDialog } from "./TaskFormDialog.js";
import { TaskPreviewDialog } from "./TaskPreviewDialog.js";

export type OpenedTask =
  | { mode: "closed" }
  | { mode: "create"; column?: TaskColumn; projectId?: string; assigneeId?: string }
  | { mode: "open"; task: Task };

export interface TaskDialogsProps {
  opened: OpenedTask;
  onClose: () => void;
}

export function TaskDialogs({ opened, onClose }: TaskDialogsProps) {
  const mayEdit = useCan("update", "task");
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const remove = useDeleteTask();

  return (
    <>
      {opened.mode === "open" && !mayEdit ? (
        <TaskPreviewDialog task={opened.task} onClose={onClose} />
      ) : null}

      {opened.mode === "create" || (opened.mode === "open" && mayEdit) ? (
        <TaskFormDialog
          task={opened.mode === "open" ? opened.task : undefined}
          column={opened.mode === "create" ? opened.column : undefined}
          projectId={opened.mode === "create" ? opened.projectId : undefined}
          assigneeId={opened.mode === "create" ? opened.assigneeId : undefined}
          onClose={onClose}
          onDelete={(task) => {
            onClose();
            setPendingDelete(task);
          }}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          open
          title={t("tasks.delete.title")}
          description={t("tasks.delete.description")}
          confirmLabel={t("tasks.delete.confirm")}
          onConfirm={() => {
            remove.mutate(pendingDelete.id);
            setPendingDelete(null);
          }}
          onClose={() => setPendingDelete(null)}
        />
      ) : null}
    </>
  );
}
