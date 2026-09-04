import { useState } from "react";
import { TaskBoard } from "@/widgets/task-board/index.js";
import { TaskFormDialog, TaskPreviewDialog } from "@/features/task-management/index.js";
import { Can, useCan } from "@/features/permissions/index.js";
import { Button, ConfirmDialog } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { useDeleteTask, type Task, type TaskColumn } from "@/entities/task/index.js";

type Editing =
  | { mode: "closed" }
  | { mode: "create"; column?: TaskColumn }
  | { mode: "edit"; task: Task }
  | { mode: "read"; task: Task };

export function TasksPage() {
  const [editing, setEditing] = useState<Editing>({ mode: "closed" });
  /* A customer raises a request and then leaves it alone — the API refuses an
     edit, so offering the form that makes one would only produce a 403. */
  const mayEdit = useCan("update", "task");
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
          onOpen={(task) => setEditing({ mode: mayEdit ? "edit" : "read", task })}
          onCreate={(column) => setEditing({ mode: "create", column })}
        />
      </div>

      {editing.mode === "read" ? (
        <TaskPreviewDialog task={editing.task} onClose={() => setEditing({ mode: "closed" })} />
      ) : null}

      {editing.mode === "create" || editing.mode === "edit" ? (
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
