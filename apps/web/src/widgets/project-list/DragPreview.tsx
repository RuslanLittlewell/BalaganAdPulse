import type { Project } from "@/entities/project/index.js";
import { ProjectItem } from "./ProjectItem.js";
import type { ProjectTone } from "./projectTone.js";

export interface DragPreviewProps {
  project?: Project;
  clientName?: string;
  tone?: ProjectTone;
  groupName?: string;
}

export function DragPreview({ project, clientName, tone, groupName }: DragPreviewProps) {
  if (project) {
    return (
      <div className="cursor-grabbing opacity-95 shadow-lg">
        <ProjectItem project={project} clientName={clientName ?? ""} tone={tone} />
      </div>
    );
  }

  if (groupName != null) {
    return (
      <div className="cursor-grabbing rounded-md border border-dashed border-muted-foreground/40 bg-background px-2 py-1 shadow-lg">
        <span className="block truncate font-mono text-2xs text-muted-foreground">
          {groupName}
        </span>
      </div>
    );
  }

  return null;
}
