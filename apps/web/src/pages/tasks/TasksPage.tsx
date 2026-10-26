import { useMemo, useState } from "react";
import { TaskBoard } from "@/widgets/task-board/index.js";
import { TaskFilters } from "@/widgets/task-filters/index.js";
import { TaskCalendar } from "@/widgets/task-calendar/index.js";
import { TaskDialogs, useTaskAddress } from "@/features/task-management/index.js";
import { TelegramBotButton } from "@/features/telegram-bot/index.js";
import { Can } from "@/features/permissions/index.js";
import { useAuth } from "@/features/auth/index.js";
import { Button, FadeContent, Tabs } from "@/shared/ui/index.js";
import { useModuleMemory, useNow } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import {
  isShelved,
  tasksOfParticipants,
  tasksOfProjects,
  useTaskEvents,
  useTasks,
  type Task,
} from "@/entities/task/index.js";

const VIEWS = ["board", "calendar", "calls"] as const;

const EMPTY: string[] = [];

const EMPTY_TASKS: Task[] = [];

type View = (typeof VIEWS)[number];

function isView(value: string | undefined): value is View {
  return VIEWS.includes(value as View);
}

export function TasksPage() {
  const { data: tasks, isLoading, isError } = useTasks();
  const { opened, open, create, close } = useTaskAddress(tasks);
  useTaskEvents();

  const userId = useAuth().user?.id ?? "";
  const remembered = useModuleMemory((state) => state.taskViews[userId]);
  const rememberTaskView = useModuleMemory((state) => state.rememberTaskView);
  const [chosen, setChosen] = useState<View | null>(null);
  const view: View = chosen ?? (isView(remembered) ? remembered : "board");

  const chosenPeople = useModuleMemory((state) => state.taskParticipants[userId]) ?? EMPTY;
  const rememberPeople = useModuleMemory((state) => state.rememberTaskParticipants);
  const chosenProjects = useModuleMemory((state) => state.taskProjects[userId]) ?? EMPTY;
  const rememberProjects = useModuleMemory((state) => state.rememberTaskProjects);

  const now = useNow();
  const onShelf = useMemo(
    () => (tasks ?? EMPTY_TASKS).filter((task) => !isShelved(task, now)),
    [tasks, now],
  );
  const shown = useMemo(
    () => tasksOfProjects(tasksOfParticipants(onShelf, chosenPeople), chosenProjects),
    [onShelf, chosenPeople, chosenProjects],
  );
  const work = useMemo(() => shown.filter((task) => !task.isCall), [shown]);
  const calls = useMemo(() => shown.filter((task) => task.isCall), [shown]);

  return (
    <section className="flex h-full flex-col gap-4">
      <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="justify-self-start">
          <TaskFilters
            tasks={onShelf}
            chosenPeople={chosenPeople}
            chosenProjects={chosenProjects}
            onPeopleChange={(next) => rememberPeople(userId, next)}
            onProjectsChange={(next) => rememberProjects(userId, next)}
          />
        </div>

        <Tabs
          items={[
            { id: "board", label: t("tasks.view.board") },
            { id: "calendar", label: t("tasks.view.calendar") },
            { id: "calls", label: t("tasks.view.calls") },
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

        <div className="flex items-center gap-2 justify-self-end">
          <TelegramBotButton />
          <Can action="create" resource="task">
            <Button onClick={() => create()}>
              {t("tasks.create")}
            </Button>
          </Can>
        </div>
      </header>


      <div className="min-h-0 flex-1">
        <FadeContent key={view} className="h-full">
          {view === "board" ? (
            <TaskBoard
              tasks={work}
              allTasks={tasks}
              isLoading={isLoading}
              isError={isError}
              onOpen={open}
              onCreate={(column) => create({ column })}
            />
          ) : (
            <TaskCalendar
              tasks={view === "calls" ? calls : work}
              isLoading={isLoading}
              isError={isError}
              onOpen={open}
            />
          )}
        </FadeContent>
      </div>

      <TaskDialogs opened={opened} onClose={close} />
    </section>
  );
}
