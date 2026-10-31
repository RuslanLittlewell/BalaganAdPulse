import { useMemo } from "react";
import { ListFilterIcon } from "lucide-react";
import { Button, MultiSelect, Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import {
  NO_PARTICIPANTS,
  NO_PROJECT_TASK,
  participantChoices,
  projectChoices,
  type Task,
} from "@/entities/task/index.js";
import { MemberAvatar, useMembers } from "@/entities/membership/index.js";
import { ProjectAvatar, useProjects } from "@/entities/project/index.js";

export interface TaskFiltersProps {
  tasks: readonly Task[];
  chosenPeople: string[];
  chosenProjects: string[];
  onPeopleChange: (next: string[]) => void;
  onProjectsChange: (next: string[]) => void;
}

export function TaskFilters({
  tasks,
  chosenPeople,
  chosenProjects,
  onPeopleChange,
  onProjectsChange,
}: TaskFiltersProps) {
  const { data: members } = useMembers();
  const { data: projects } = useProjects();

  const people = useMemo(
    () => participantChoices(tasks, members ?? [], chosenPeople),
    [tasks, members, chosenPeople],
  );
  const projectOptions = useMemo(
    () => projectChoices(tasks, projects ?? [], chosenProjects),
    [tasks, projects, chosenProjects],
  );

  const chosenCount = chosenPeople.length + chosenProjects.length;
  const filters = (className: string) => (
    <>
      <MultiSelect
        items={people.map((choice) => ({
          value: choice.id,
          label: choice.id === NO_PARTICIPANTS ? t("tasks.participants.nobody") : choice.name,
          icon: choice.member ? <MemberAvatar member={choice.member} size="sm" /> : undefined,
        }))}
        chosen={chosenPeople}
        onChange={onPeopleChange}
        allLabel={t("tasks.filter.all")}
        placeholder={t("tasks.participants.filter")}
        ariaLabel={t("tasks.participants.filterLabel")}
        className={className}
      />
      <MultiSelect
        items={projectOptions.map((choice) => ({
          value: choice.id,
          label: choice.id === NO_PROJECT_TASK ? t("tasks.noProject") : choice.name,
          icon: choice.project ? <ProjectAvatar project={choice.project} size="sm" /> : undefined,
        }))}
        chosen={chosenProjects}
        onChange={onProjectsChange}
        allLabel={t("tasks.filter.all")}
        searchable
        placeholder={t("tasks.projects.filter")}
        ariaLabel={t("tasks.projects.filterLabel")}
        className={className}
      />
    </>
  );

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="hidden min-w-0 items-center gap-3 md:flex">{filters("max-w-52")}</div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon-lg"
            aria-label={
              chosenCount > 0
                ? `${t("tasks.filters")}, ${t("tasks.filters.chosen")}: ${chosenCount}`
                : t("tasks.filters")
            }
            className="relative md:hidden"
          >
            <ListFilterIcon aria-hidden />
            {chosenCount > 0 ? (
              <span
                aria-hidden
                className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-2xs font-semibold text-primary-foreground"
              >
                {chosenCount}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" aria-label={t("tasks.filters")} className="grid w-64 gap-2 p-2">
          {filters("w-full")}
        </PopoverContent>
      </Popover>
    </div>
  );
}
