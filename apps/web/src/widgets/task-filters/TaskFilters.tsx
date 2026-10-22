import { useMemo } from "react";
import { MultiSelect } from "@/shared/ui/index.js";
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

  return (
    <div className="flex min-w-0 items-center gap-3">
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
        className="max-w-52"
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
        className="max-w-52"
      />
    </div>
  );
}
