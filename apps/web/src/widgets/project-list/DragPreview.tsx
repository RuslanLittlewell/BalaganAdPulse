import type { Project } from "@/entities/project/index.js";
import { ProjectItem } from "./ProjectItem.js";

export interface DragPreviewProps {
  project?: Project;
  clientName?: string;
  groupName?: string;
}

export function DragPreview({ project, clientName, groupName }: DragPreviewProps) {
  if (project) {
    return (
      <div className="cursor-grabbing opacity-95 shadow-lg">
        <ProjectItem project={project} clientName={clientName ?? ""} />
      </div>
    );
  }

  if (groupName != null) {
    return (
      <div className="cursor-grabbing rounded-md border border-dashed border-muted-foreground/40 bg-background px-2 py-1 shadow-lg">
        <span className="block truncate font-mono text-[11px] uppercase tracking-[.12em] text-muted-foreground">
          {groupName}
        </span>
      </div>
    );
  }

  return null;
}
