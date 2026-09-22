import { useState } from "react";
import { TaskBoard } from "@/widgets/task-board/index.js";
import { TaskCalendar } from "@/widgets/task-calendar/index.js";
import { TaskFormDialog, TaskPreviewDialog } from "@/features/task-management/index.js";
import { Can, useCan } from "@/features/permissions/index.js";
import { useAuth } from "@/features/auth/index.js";
import { Button, ConfirmDialog, FadeContent, Tabs } from "@/shared/ui/index.js";
import { useModuleMemory } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import {
  useDeleteTask,
  useTaskEvents,
  useTasks,
  type Task,
  type TaskColumn,
} from "@/entities/task/index.js";
import { CampaignNamesSync } from "@/entities/campaign/index.js";

type Editing =
  | { mode: "closed" }
  | { mode: "create"; column?: TaskColumn }
  | { mode: "edit"; task: Task }
  | { mode: "read"; task: Task };

const VIEWS = ["board", "calendar"] as const;

type View = (typeof VIEWS)[number];

function isView(value: string | undefined): value is View {
  return VIEWS.includes(value as View);
}

export function TasksPage() {
  const [editing, setEditing] = useState<Editing>({ mode: "closed" });
  const mayEdit = useCan("update", "task");
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const remove = useDeleteTask();
  const { data: tasks, isLoading, isError } = useTasks();
  useTaskEvents();

  const userId = useAuth().user?.id ?? "";
  const remembered = useModuleMemory((state) => state.taskViews[userId]);
  const rememberTaskView = useModuleMemory((state) => state.rememberTaskView);
  const [chosen, setChosen] = useState<View | null>(null);
  const view: View = chosen ?? (isView(remembered) ? remembered : "board");

  const open = (task: Task) => setEditing({ mode: mayEdit ? "edit" : "read", task });

  return (
    <section className="flex h-full flex-col gap-4">
      <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3">
        <h1 className="justify-self-start text-2xl font-bold">{t("tasks.title")}</h1>

        <Tabs
          items={[
            { id: "board", label: t("tasks.view.board") },
            { id: "calendar", label: t("tasks.view.calendar") },
          ]}
          activeId={view}
          onSelect={(id) => {
            if (!isView(id)) return;
            setChosen(id);
            if (userId) rememberTaskView(userId, id);
          }}
          ariaLabel={t("tasks.view.label")}
          className="justify-self-center"
        />

        <Can action="create" resource="task">
          <Button className="justify-self-end" onClick={() => setEditing({ mode: "create" })}>
            {t("tasks.create")}
          </Button>
        </Can>
      </header>

      <CampaignNamesSync />

      <div className="min-h-0 flex-1">
        <FadeContent key={view} className="h-full">
          {view === "board" ? (
            <TaskBoard
              tasks={tasks}
              isLoading={isLoading}
              isError={isError}
              onOpen={open}
              onCreate={(column) => setEditing({ mode: "create", column })}
            />
          ) : (
            <TaskCalendar
              tasks={tasks}
              isLoading={isLoading}
              isError={isError}
              onOpen={open}
            />
          )}
        </FadeContent>
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
