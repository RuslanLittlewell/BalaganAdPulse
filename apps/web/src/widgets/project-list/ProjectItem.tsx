import { ListItem } from "@/shared/ui/index.js";
import WarmTooltip from "@/shared/ui/WarmTooltip/WarmTooltip.js";
import { t } from "@/shared/config/index.js";
import {
  ProjectAvatar,
  priorityColour,
  priorityLabel,
  type Project,
} from "@/entities/project/index.js";

export interface ProjectItemProps {
  project: Project;
  clientName: string;
  selected?: boolean;
  collapsed?: boolean;
  onOpen?: () => void;
  onEdit?: () => void;
}

export function ProjectItem({
  project,
  clientName,
  selected = false,
  collapsed = false,
  onOpen,
  onEdit,
}: ProjectItemProps) {
  if (collapsed) {
    return (
      <WarmTooltip content={project.name} side="right">
        <button
          type="button"
          onClick={onOpen}
          aria-label={project.name}
          aria-current={selected ? "page" : undefined}
          data-selected={selected}
          className="mx-auto mb-1 grid rounded-md p-1 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[selected=true]:bg-accent"
        >
          <ProjectAvatar project={project} size="sm" />
        </button>
      </WarmTooltip>
    );
  }

  return (
    <ListItem
      selected={selected}
      leading={<ProjectAvatar project={project} size="sm" />}
      marker={priorityColour(project.priority)}
      markerLabel={`${t("priority.title")}: ${priorityLabel(project.priority)}`}
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
