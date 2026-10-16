import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { dragId, type Project } from "@/entities/project/index.js";
import { ProjectItem } from "./ProjectItem.js";
import type { ProjectTone } from "./projectTone.js";

export interface ProjectRowProps {
  project: Project;
  clientName: string;
  tone: ProjectTone;
  selected: boolean;
  draggable: boolean;
  pinned: boolean;
  collapsed?: boolean;
  sorting: boolean;
  onOpen: () => void;
  onEdit?: () => void;
  onPin: () => void;
}

export function ProjectRow({
  project,
  clientName,
  tone,
  selected,
  draggable,
  pinned,
  collapsed = false,
  sorting,
  onOpen,
  onEdit,
  onPin,
}: ProjectRowProps) {
  const sortable = useSortable({ id: dragId.project(project.id), disabled: !draggable });

  return (
    <div
      ref={sortable.setNodeRef}
      style={sorting && !sortable.isDragging
        ? { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }
        : undefined}
      {...(draggable ? sortable.listeners : {})}
      className={`min-w-0 data-[dragging=true]:opacity-50 ${draggable ? "cursor-grab" : ""}`}
      data-testid={`project-row-${project.id}`}
      data-draggable={draggable}
      data-drag-handle={draggable ? "row" : undefined}
      data-pinned={pinned}
      data-dragging={sortable.isDragging}
    >
      <div className="min-w-0">
        <ContextMenu>
          <ContextMenuTrigger>
            <ProjectItem
              project={project}
              clientName={clientName}
              tone={tone}
              selected={selected}
              collapsed={collapsed}
              onOpen={onOpen}
              onEdit={onEdit}
            />
          </ContextMenuTrigger>
          <ContextMenuContent>
            {onEdit && (
              <ContextMenuItem onSelect={onEdit}>{t("project.edit")}</ContextMenuItem>
            )}
            <ContextMenuItem onSelect={onPin}>
              {t(pinned ? "projects.unpin" : "projects.pin")}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>
  );
}
