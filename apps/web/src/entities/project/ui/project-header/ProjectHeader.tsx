import { t } from "@/shared/config/index.js";
import { Switch } from "@/shared/ui/index.js";
import { ProjectAvatar } from "../project-avatar/ProjectAvatar.js";
import type { Project } from "../../api/api.js";

export interface ProjectHeaderProps {
  project: Project;
  clientName: string;
  onKpiTrackedChange?: (tracked: boolean) => void;
  kpiTrackedPending?: boolean;
}

export function ProjectHeader({ project, clientName, onKpiTrackedChange, kpiTrackedPending = false }: ProjectHeaderProps) {
  return (
    <header className="flex min-h-16 items-center gap-3 border-b border-border pb-4">
      <ProjectAvatar project={project} size="lg" />
      <div className="grid min-w-0">
        <h1 className="truncate text-lg font-semibold">{project.name}</h1>
        <p className="truncate text-sm text-muted-foreground">{clientName}</p>
      </div>
      <label className="ml-auto flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        <Switch
          checked={project.kpiTracked !== false}
          disabled={onKpiTrackedChange === undefined || kpiTrackedPending}
          aria-label={t("project.kpiTracked")}
          onCheckedChange={onKpiTrackedChange}
        />
        {t("project.kpiTracked")}
      </label>
    </header>
  );
}
