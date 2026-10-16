import { useId } from "react";
import { ListItem } from "@/shared/ui/index.js";
import WarmTooltip from "@/shared/ui/WarmTooltip/WarmTooltip.js";
import { t } from "@/shared/config/index.js";
import { ProjectAvatar, type Project } from "@/entities/project/index.js";
import type { ProjectTone } from "./projectTone.js";

const MARKER: Record<ProjectTone, string> = {
  none: "var(--kpi-marker-none)",
  danger: "var(--kpi-marker-danger)",
  behind: "var(--kpi-marker-behind)",
  met: "var(--kpi-marker-met)",
};

export interface ProjectItemProps {
  project: Project;
  clientName: string;
  tone?: ProjectTone;
  selected?: boolean;
  collapsed?: boolean;
  onOpen?: () => void;
  onEdit?: () => void;
}

export function ProjectItem({
  project,
  clientName,
  tone = "none",
  selected = false,
  collapsed = false,
  onOpen,
  onEdit,
}: ProjectItemProps) {
  const markerId = useId();
  const markerLabel = t(`projects.kpiMarker.${tone}`);

  if (collapsed) {
    return (
      <WarmTooltip content={project.name} side="right">
        <button
          type="button"
          onClick={onOpen}
          aria-label={project.name}
          aria-describedby={markerId}
          aria-current={selected ? "page" : undefined}
          data-selected={selected}
          className="mx-auto mb-1 grid rounded-md p-1 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[selected=true]:bg-accent"
        >
          <span className="relative">
            <ProjectAvatar project={project} size="sm" />
            <span
              aria-hidden="true"
              className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background"
              style={{ background: MARKER[tone] }}
            />
          </span>
          <span id={markerId} className="sr-only">{markerLabel}</span>
        </button>
      </WarmTooltip>
    );
  }

  return (
    <ListItem
      selected={selected}
      leading={<ProjectAvatar project={project} size="sm" />}
      marker={MARKER[tone]}
      markerLabel={markerLabel}
      onEdit={onEdit}
      editLabel={`${t("project.edit")}: ${project.name}`}
      onClick={onOpen}
    >
      <span className="grid min-w-0 text-left">
        <span className="truncate">{project.name}</span>
        <span className="truncate text-xs text-muted-foreground">{clientName}</span>
      </span>
    </ListItem>
  );
}
