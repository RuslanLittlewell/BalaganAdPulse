import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import {
  PROJECT_PRIORITIES,
  dragId,
  priorityColour,
  priorityLabel,
  type Project,
  type ProjectPriority,
} from "@/entities/project/index.js";
import { ProjectItem } from "./ProjectItem.js";

export interface ProjectRowProps {
  project: Project;
  clientName: string;
  selected: boolean;
  draggable: boolean;
  pinned: boolean;
  sorting: boolean;
  mayUpdate: boolean;
  onOpen: () => void;
  onEdit?: () => void;
  onPin: () => void;
  onPriority: (priority: ProjectPriority) => void;
}

export function ProjectRow({
  project,
  clientName,
  selected,
  draggable,
  pinned,
  sorting,
  mayUpdate,
  onOpen,
  onEdit,
  onPin,
  onPriority,
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
              selected={selected}
              onOpen={onOpen}
              onEdit={onEdit}
            />
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={onPin}>
              {t(pinned ? "projects.unpin" : "projects.pin")}
            </ContextMenuItem>
            {mayUpdate && (
              <>
                <ContextMenuSeparator />
                <ContextMenuLabel>{t("priority.title")}</ContextMenuLabel>
                <ContextMenuRadioGroup
                  value={project.priority}
                  onValueChange={(priority) => onPriority(priority as ProjectPriority)}
                >
                  {PROJECT_PRIORITIES.map((priority) => (
                    <ContextMenuRadioItem key={priority} value={priority}>
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: priorityColour(priority) }}
                        aria-hidden="true"
                      />
                      {priorityLabel(priority)}
                    </ContextMenuRadioItem>
                  ))}
                </ContextMenuRadioGroup>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>
  );
}
