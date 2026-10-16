import { ProjectAvatar } from "../project-avatar/ProjectAvatar.js";
import type { Project } from "../../api/api.js";

export interface ProjectHeaderProps {
  project: Project;
  clientName: string;
}

export function ProjectHeader({ project, clientName }: ProjectHeaderProps) {
  return (
    <header className="flex min-h-16 items-center gap-3 border-b border-border pb-4">
      <ProjectAvatar project={project} size="lg" />
      <div className="grid min-w-0">
        <h1 className="truncate text-lg font-semibold">{project.name}</h1>
        <p className="truncate text-sm text-muted-foreground">{clientName}</p>
      </div>
    </header>
  );
}
