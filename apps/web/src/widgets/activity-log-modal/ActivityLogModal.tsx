import { getIntlLocale } from "@/shared/config/locale.js";
import { useMemo, useState } from "react";
import { useAuditActors, type AuditEventFilters, type AuditSection } from "@/entities/audit-event/index.js";
import { useProjects } from "@/entities/project/index.js";
import { t } from "@/shared/config/index.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  SearchableSelect,
  Tabs,
} from "@/shared/ui/index.js";
import { ActivityList } from "./ActivityList.js";

export interface ActivityLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TypeSection = AuditSection;
type Section = TypeSection | "people";

const allProjects = (): Record<TypeSection, string> => ({ projects: ALL, tasks: ALL, crm: ALL });

const ALL = "all";

const SECTIONS = [
  { id: "projects", label: t("activity.tab.projects") },
  { id: "tasks", label: t("activity.tab.tasks") },
  { id: "crm", label: t("activity.tab.crm") },
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
    <SearchableSelect
      value={value}
      onValueChange={onChange}
      pinned={[{ value: ALL, label: allLabel }]}
      options={options.map((option) => ({ value: option.id, label: option.name }))}
      searchLabel={t("select.search")}
      emptyLabel={t("select.search.empty")}
      ariaLabel={label}
      className="sm:w-51"
    />
  );
}

const byName = (left: Option, right: Option) => left.name.localeCompare(right.name, getIntlLocale());

function ActivitySections() {
  const [section, setSection] = useState<Section>("projects");
  const [projectIds, setProjectIds] = useState(allProjects);
  const [actorId, setActorId] = useState(ALL);
  const projects = useProjects();
  const actors = useAuditActors();

  const projectOptions = useMemo(() => [...(projects.data ?? [])].sort(byName), [projects.data]);
  const projectNames = useMemo(
    () => new Map((projects.data ?? []).map((project) => [project.id, project.name])),
    [projects.data],
  );
  const projectId = section === "people" ? ALL : projectIds[section];
  const filters: AuditEventFilters = section === "people"
    ? (actorId === ALL ? {} : { actorId })
    : (projectId === ALL ? { section } : { section, projectId });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          items={SECTIONS}
          activeId={section}
          onSelect={(id) => setSection(id as Section)}
          ariaLabel={t("activity.tabs")}
        />
        {section === "people" ? (
          <FilterSelect
            label={t("activity.filter.person")}
            allLabel={t("activity.allPeople")}
            options={actors.data ?? []}
            value={actorId}
            onChange={setActorId}
          />
        ) : (
          <FilterSelect
            label={t("activity.filter.project")}
            allLabel={t("activity.allProjects")}
            options={projectOptions}
            value={projectId}
            onChange={(id) => setProjectIds((current) => ({ ...current, [section]: id }))}
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
