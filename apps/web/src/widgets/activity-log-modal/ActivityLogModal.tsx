import { useMemo, useState } from "react";
import { useAuditActors, type AuditEventFilters } from "@/entities/audit-event/index.js";
import { useProjects } from "@/entities/project/index.js";
import { t } from "@/shared/config/index.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
} from "@/shared/ui/index.js";
import { ActivityList } from "./ActivityList.js";

export interface ActivityLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Section = "projects" | "people";

const ALL = "all";

const SECTIONS = [
  { id: "projects", label: t("activity.tab.projects") },
  { id: "people", label: t("activity.tab.people") },
];

interface Option {
  id: string;
  name: string;
}

function FilterSelect({ label, allLabel, options, value, onChange }: {
  label: string;
  allLabel: string;
  options: readonly Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-full sm:w-64"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const byName = (left: Option, right: Option) => left.name.localeCompare(right.name, "ru");

function ActivitySections() {
  const [section, setSection] = useState<Section>("projects");
  const [projectId, setProjectId] = useState(ALL);
  const [actorId, setActorId] = useState(ALL);
  const projects = useProjects();
  const actors = useAuditActors();

  const projectOptions = useMemo(() => [...(projects.data ?? [])].sort(byName), [projects.data]);
  const projectNames = useMemo(
    () => new Map((projects.data ?? []).map((project) => [project.id, project.name])),
    [projects.data],
  );
  const filters: AuditEventFilters = section === "projects"
    ? (projectId === ALL ? { inProject: true } : { projectId })
    : (actorId === ALL ? {} : { actorId });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          items={SECTIONS}
          activeId={section}
          onSelect={(id) => setSection(id as Section)}
          ariaLabel={t("activity.tabs")}
        />
        {section === "projects" ? (
          <FilterSelect
            label={t("activity.filter.project")}
            allLabel={t("activity.allProjects")}
            options={projectOptions}
            value={projectId}
            onChange={setProjectId}
          />
        ) : (
          <FilterSelect
            label={t("activity.filter.person")}
            allLabel={t("activity.allPeople")}
            options={actors.data ?? []}
            value={actorId}
            onChange={setActorId}
          />
        )}
      </div>
      <ActivityList filters={filters} projectNames={projectNames} />
    </div>
  );
}

export function ActivityLogModal({ open, onOpenChange }: ActivityLogModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(44rem,calc(90vh-2rem))] w-[min(720px,calc(100vw-2rem))] max-w-none flex-col overflow-hidden">
        <DialogHeader><DialogTitle>{t("activity.title")}</DialogTitle></DialogHeader>
        {open && <ActivitySections />}
      </DialogContent>
    </Dialog>
  );
}
