import { useMemo, useState } from "react";
import { TaskBoard } from "@/widgets/task-board/index.js";
import { TaskCalendar } from "@/widgets/task-calendar/index.js";
import { TaskDialogs, type OpenedTask } from "@/features/task-management/index.js";
import { Can } from "@/features/permissions/index.js";
import { useAuth } from "@/features/auth/index.js";
import { Button, FadeContent, MultiSelect, Tabs } from "@/shared/ui/index.js";
import { useModuleMemory } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import {
  UNASSIGNED_TASK,
  assigneeChoices,
  tasksOfAssignees,
  useTaskEvents,
  useTasks,
  type Task,
} from "@/entities/task/index.js";
import { MemberAvatar, useMembers } from "@/entities/membership/index.js";

const VIEWS = ["board", "calendar"] as const;

const EMPTY: string[] = [];

type View = (typeof VIEWS)[number];

function isView(value: string | undefined): value is View {
  return VIEWS.includes(value as View);
}

export function TasksPage() {
  const [opened, setOpened] = useState<OpenedTask>({ mode: "closed" });
  const { data: tasks, isLoading, isError } = useTasks();
  const { data: members } = useMembers();
  useTaskEvents();

  const userId = useAuth().user?.id ?? "";
  const remembered = useModuleMemory((state) => state.taskViews[userId]);
  const rememberTaskView = useModuleMemory((state) => state.rememberTaskView);
  const [chosen, setChosen] = useState<View | null>(null);
  const view: View = chosen ?? (isView(remembered) ? remembered : "board");

  const assignees = useModuleMemory((state) => state.taskAssignees[userId]) ?? EMPTY;
  const rememberAssignees = useModuleMemory((state) => state.rememberTaskAssignees);

  const choices = useMemo(
    () => assigneeChoices(tasks ?? [], members ?? [], assignees),
    [tasks, members, assignees],
  );
  const shown = useMemo(
    () => tasksOfAssignees(tasks ?? [], assignees),
    [tasks, assignees],
  );

  const open = (task: Task) => setOpened({ mode: "open", task });

  return (
    <section className="flex h-full flex-col gap-4">
      <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3 justify-self-start">
          <MultiSelect
            items={choices.map((choice) => ({
              value: choice.id,
              label: choice.id === UNASSIGNED_TASK
                ? t("tasks.assignees.unassigned")
                : choice.name,
              icon: choice.member
                ? <MemberAvatar member={choice.member} size="sm" />
                : undefined,
            }))}
            chosen={assignees}
            onChange={(next) => rememberAssignees(userId, next)}
            placeholder={t("tasks.assignees.filter")}
            ariaLabel={t("tasks.assignees.filterLabel")}
            className="max-w-52"
          />
        </div>

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
          <Button className="justify-self-end" onClick={() => setOpened({ mode: "create" })}>
            {t("tasks.create")}
          </Button>
        </Can>
      </header>


      <div className="min-h-0 flex-1">
        <FadeContent key={view} className="h-full">
          {view === "board" ? (
            <TaskBoard
              tasks={shown}
              isLoading={isLoading}
              isError={isError}
              onOpen={open}
              onCreate={(column) => setOpened({ mode: "create", column })}
            />
          ) : (
            <TaskCalendar
              tasks={shown}
              isLoading={isLoading}
              isError={isError}
              onOpen={open}
            />
          )}
        </FadeContent>
      </div>

      <TaskDialogs opened={opened} onClose={() => setOpened({ mode: "closed" })} />
    </section>
  );
}
