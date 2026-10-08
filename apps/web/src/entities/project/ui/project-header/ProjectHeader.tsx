import { HistoryIcon } from "lucide-react";
import { t } from "@/shared/config/index.js";
import { Button } from "@/shared/ui/index.js";
import { ProjectAvatar } from "../project-avatar/ProjectAvatar.js";
import type { Project } from "../../api/api.js";

export interface ProjectHeaderProps {
  project: Project;
  clientName: string;
  onShowActivity?: () => void;
}

export function ProjectHeader({ project, clientName, onShowActivity }: ProjectHeaderProps) {
  return (
    <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border pb-4">
      <div className="flex min-w-0 items-center gap-3">
        <ProjectAvatar project={project} size="lg" />
        <div className="grid min-w-0">
          <h1 className="truncate text-lg font-semibold">{project.name}</h1>
          <p className="truncate text-sm text-muted-foreground">{clientName}</p>
        </div>
      </div>
      {onShowActivity != null && (
        <div className="shrink-0">
          <Button variant="outline" size="sm" onClick={onShowActivity}>
            <HistoryIcon /> {t("activity.title")}
          </Button>
        </div>
      )}
    </header>
  );
}
