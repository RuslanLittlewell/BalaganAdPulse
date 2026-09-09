import type { ReactNode } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { dragId } from "@/entities/project/index.js";

export interface ProjectGroupCardProps {
  groupId: string;
  name: string;
  projectIds: string[];
  draggable: boolean;
  sorting: boolean;
  onDelete: () => void;
  children: ReactNode;
}

export function ProjectGroupCard({
  groupId,
  name,
  projectIds,
  draggable,
  sorting,
  onDelete,
  children,
}: ProjectGroupCardProps) {
  const sortable = useSortable({ id: dragId.group(groupId), disabled: !draggable });

  return (
    <div
      ref={sortable.setNodeRef}
      style={sorting && !sortable.isDragging
        ? { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }
        : undefined}
      role="group"
      aria-label={name}
      data-testid={`project-group-${groupId}`}
      data-dragging={sortable.isDragging}
      className="mb-1 rounded-md border border-dashed border-muted-foreground/40 p-1 data-[dragging=true]:opacity-50"
    >
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            ref={sortable.setActivatorNodeRef}
            {...(draggable ? sortable.listeners : {})}
            data-testid={`project-group-${groupId}-header`}
            data-drag-handle={draggable ? "group" : undefined}
            className={`px-1 py-1 ${draggable ? "cursor-grab" : ""}`}
          >
            <span className="block truncate font-mono text-[11px] uppercase tracking-[.12em] text-muted-foreground">
              {name}
            </span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={onDelete}>{t("projects.group.delete")}</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <SortableContext
        items={projectIds.map(dragId.project)}
        strategy={verticalListSortingStrategy}
      >
        <div className="min-h-9">{children}</div>
      </SortableContext>
    </div>
  );
}
