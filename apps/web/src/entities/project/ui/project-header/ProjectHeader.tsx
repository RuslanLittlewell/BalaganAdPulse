import { t } from "@/shared/config/index.js";
import { formatValue } from "@/shared/lib/index.js";
import { ProjectAvatar } from "../project-avatar/ProjectAvatar.js";
import type { Project } from "../../api/api.js";

export interface ProjectHeaderProps {
  project: Project;
  /** The company the work is for — a project is never shown without it. */
  clientName: string;
}

export function ProjectHeader({ project, clientName }: ProjectHeaderProps) {
  const facts = [clientName, project.niche, project.monthlyBudget
    ? `${formatValue(project.monthlyBudget, "MONEY")} / ${t("project.budget.label").split("/")[1]?.trim() ?? ""}`
    : null].filter(Boolean);

  return (
    <header className="flex min-h-16 items-center gap-4 border-b border-border pb-4">
      <div className="flex min-w-0 items-center gap-3">
        <ProjectAvatar project={project} size="lg" />
        <div className="grid min-w-0">
          <h1 className="truncate text-lg font-semibold">{project.name}</h1>
          <p className="truncate text-sm text-muted-foreground">{facts.join(" · ")}</p>
        </div>
      </div>
    </header>
  );
}
