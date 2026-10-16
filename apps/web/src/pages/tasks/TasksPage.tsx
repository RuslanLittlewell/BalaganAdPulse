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
  NO_PARTICIPANTS,
  NO_PROJECT_TASK,
  participantChoices,
  projectChoices,
  tasksOfParticipants,
  tasksOfProjects,
  useTaskEvents,
  useTasks,
  type Task,
} from "@/entities/task/index.js";
import { MemberAvatar, useMembers } from "@/entities/membership/index.js";
import { ProjectAvatar, useProjects } from "@/entities/project/index.js";

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
  const { data: projects } = useProjects();
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

  const choices = useMemo(
    () => participantChoices(tasks ?? [], members ?? [], chosenPeople),
    [tasks, members, chosenPeople],
  );
  const projectOptions = useMemo(
    () => projectChoices(tasks ?? [], projects ?? [], chosenProjects),
    [tasks, projects, chosenProjects],
  );
  const shown = useMemo(
    () => tasksOfProjects(tasksOfParticipants(tasks ?? [], chosenPeople), chosenProjects),
    [tasks, chosenPeople, chosenProjects],
  );

  const open = (task: Task) => setOpened({ mode: "open", task });

  return (
    <section className="flex h-full flex-col gap-4">
      <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3 justify-self-start">
          <MultiSelect
            items={choices.map((choice) => ({
              value: choice.id,
              label: choice.id === NO_PARTICIPANTS
                ? t("tasks.participants.nobody")
                : choice.name,
              icon: choice.member
                ? <MemberAvatar member={choice.member} size="sm" />
                : undefined,
            }))}
            chosen={chosenPeople}
            onChange={(next) => rememberPeople(userId, next)}
            placeholder={t("tasks.participants.filter")}
            ariaLabel={t("tasks.participants.filterLabel")}
            className="max-w-52"
          />
          <MultiSelect
            items={projectOptions.map((choice) => ({
              value: choice.id,
              label: choice.id === NO_PROJECT_TASK ? t("tasks.noProject") : choice.name,
              icon: choice.project
                ? <ProjectAvatar project={choice.project} size="sm" />
                : undefined,
            }))}
            chosen={chosenProjects}
            onChange={(next) => rememberProjects(userId, next)}
            placeholder={t("tasks.projects.filter")}
            ariaLabel={t("tasks.projects.filterLabel")}
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
