import { t } from "@/shared/config/index.js";
import { formatCurrency } from "@/shared/lib/index.js";
import { ProjectAvatar } from "../project-avatar/ProjectAvatar.js";
import type { Project } from "../../api/api.js";

export interface ProjectHeaderProps {
  project: Project;
  clientName: string;
  actions?: ReactNode;
}

export function ProjectHeader({ project, clientName, actions }: ProjectHeaderProps) {
  const facts = [clientName, project.niche, project.monthlyBudget
    ? `${formatCurrency(Number(project.monthlyBudget), project.budgetCurrency)} / ${t("project.budget.label").split("/")[1]?.trim() ?? ""}`
    : null].filter(Boolean);

  return (
    <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border pb-4">
      <div className="flex min-w-0 items-center gap-3">
        <ProjectAvatar project={project} size="lg" />
        <div className="grid min-w-0">
          <h1 className="truncate text-lg font-semibold">{project.name}</h1>
          <p className="truncate text-sm text-muted-foreground">{facts.join(" · ")}</p>
        </div>
      </div>
      {actions != null && <div className="shrink-0">{actions}</div>}
    </header>
  );
}
import type { ReactNode } from "react";
