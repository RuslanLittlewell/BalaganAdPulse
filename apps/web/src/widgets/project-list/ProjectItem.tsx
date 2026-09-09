import { ListItem } from "@/shared/ui/index.js";
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
  onOpen?: () => void;
  onEdit?: () => void;
}

export function ProjectItem({
  project,
  clientName,
  selected = false,
  onOpen,
  onEdit,
}: ProjectItemProps) {
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
