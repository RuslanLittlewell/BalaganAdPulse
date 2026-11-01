import { useMemo } from "react";
import { TaskFilters } from "@/widgets/task-filters/index.js";
import { TaskDialogs, useTaskAddress } from "@/features/task-management/index.js";
import { useAuth } from "@/features/auth/index.js";
import { EmptyState, Loader } from "@/shared/ui/index.js";
import { formatCalendarDate, useModuleMemory, useNow } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import {
  isShelved,
  participantsOf,
  tasksOfParticipants,
  tasksOfProjects,
  useTaskEvents,
  useTasks,
  type Task,
} from "@/entities/task/index.js";
import { MemberAvatar, useMembers } from "@/entities/membership/index.js";
import { ProjectAvatar, useProjects } from "@/entities/project/index.js";

const EMPTY: string[] = [];

const EMPTY_TASKS: Task[] = [];

function archivedMoment(task: Task): number {
  return task.archivedAt === null ? 0 : new Date(task.archivedAt).getTime();
}

export function ArchivePage() {
  const { data: tasks, isLoading, isError } = useTasks();
  const { opened, open, close } = useTaskAddress(tasks);
  const { data: members } = useMembers();
  const { data: projects } = useProjects();
  useTaskEvents();
  const now = useNow();

  const userId = useAuth().user?.id ?? "";
  const chosenPeople = useModuleMemory((state) => state.archiveParticipants[userId]) ?? EMPTY;
  const rememberPeople = useModuleMemory((state) => state.rememberArchiveParticipants);
  const chosenProjects = useModuleMemory((state) => state.archiveProjects[userId]) ?? EMPTY;
  const rememberProjects = useModuleMemory((state) => state.rememberArchiveProjects);

  const shelved = useMemo(
    () => (tasks ?? EMPTY_TASKS).filter((task) => isShelved(task, now)),
    [tasks, now],
  );
  const listed = useMemo(
    () => tasksOfProjects(tasksOfParticipants(shelved, chosenPeople), chosenProjects)
      .sort((a, b) => archivedMoment(b) - archivedMoment(a)),
    [shelved, chosenPeople, chosenProjects],
  );

  return (
    <section className="flex h-full flex-col gap-3">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t("nav.archive")}</h1>
        <TaskFilters
          tasks={shelved}
          chosenPeople={chosenPeople}
          chosenProjects={chosenProjects}
          onPeopleChange={(next) => rememberPeople(userId, next)}
          onProjectsChange={(next) => rememberProjects(userId, next)}
        />
      </header>

      {isLoading ? (
        <Loader />
      ) : isError ? (
        <EmptyState title={t("tasks.loadFailed")} />
      ) : listed.length === 0 ? (
        <EmptyState
          title={shelved.length === 0 ? t("archive.empty") : t("archive.noMatches")}
          description={shelved.length === 0 ? t("archive.emptyHint") : undefined}
        />
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {listed.map((task) => {
            const project = projects?.find((candidate) => candidate.id === task.projectId);
            const people = participantsOf(task, members);
            return (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => open(task)}
                  className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-accent/60"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{task.title}</span>
                  <span className="flex w-38 min-w-0 items-center gap-2 text-sm text-muted-foreground">
                    {project ? (
                      <>
                        <ProjectAvatar project={project} size="sm" />
                        <span className="truncate">{project.name}</span>
                      </>
                    ) : (
                      <span>{t("tasks.noProject")}</span>
                    )}
                  </span>
                  <span className="flex w-32 min-w-0 items-center gap-1">
                    {people.length === 0 ? (
                      <span className="text-sm text-muted-foreground">{t("tasks.participants.nobody")}</span>
                    ) : (
                      people.map((member) => (
                        <MemberAvatar key={member.id} member={member} size="sm" />
                      ))
                    )}
                  </span>
                  <span className="w-35 shrink-0 text-right text-xs text-muted-foreground">
                    {t("archive.since")} {task.archivedAt ? formatCalendarDate(task.archivedAt) : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <TaskDialogs opened={opened} onClose={close} />
    </section>
  );
}
