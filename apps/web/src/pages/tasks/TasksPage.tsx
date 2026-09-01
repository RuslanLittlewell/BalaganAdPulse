import { useState } from "react";
import { TaskBoard } from "@/widgets/task-board/index.js";
import { TaskFormDialog } from "@/features/task-management/index.js";
import { Can } from "@/features/permissions/index.js";
import { Button, ConfirmDialog } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { useDeleteTask, type Task, type TaskColumn } from "@/entities/task/index.js";

type Editing =
  | { mode: "closed" }
  | { mode: "create"; column?: TaskColumn }
  | { mode: "edit"; task: Task };

export function TasksPage() {
  const [editing, setEditing] = useState<Editing>({ mode: "closed" });
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const remove = useDeleteTask();

  return (
    <section className="flex h-full flex-col gap-4">
      <header className="flex shrink-0 items-center justify-between">
        <h1 className="text-2xl font-bold">{t("tasks.title")}</h1>
        <Can action="create" resource="task">
          <Button onClick={() => setEditing({ mode: "create" })}>{t("tasks.create")}</Button>
        </Can>
      </header>

      <div className="min-h-0 flex-1">
        <TaskBoard
          onOpen={(task) => setEditing({ mode: "edit", task })}
          onCreate={(column) => setEditing({ mode: "create", column })}
        />
      </div>

      {editing.mode !== "closed" ? (
        <TaskFormDialog
          task={editing.mode === "edit" ? editing.task : undefined}
          column={editing.mode === "create" ? editing.column : undefined}
          onClose={() => setEditing({ mode: "closed" })}
          onDelete={(task) => { setEditing({ mode: "closed" }); setPendingDelete(task); }}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          open
          title={t("tasks.delete.title")}
          description={t("tasks.delete.description")}
          confirmLabel={t("tasks.delete.confirm")}
          onConfirm={() => { remove.mutate(pendingDelete.id); setPendingDelete(null); }}
          onClose={() => setPendingDelete(null)}
        />
      ) : null}
    </section>
  );
}
