import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlusIcon } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  EmptyState,
  Loader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { projectPath, ROUTES } from "@/shared/lib/index.js";
import { useClients } from "@/entities/client/index.js";
import {
  EMPTY_LAYOUT,
  LIST_END,
  PROJECT_PRIORITIES,
  arrangeProjects,
  dragId,
  moveInLayout,
  parseDragId,
  pinProject,
  priorityLabel,
  unpinProject,
  useActiveProjectId,
  useCreateProjectGroup,
  useDeleteProjectGroup,
  useProjectLayout,
  useProjects,
  useSaveProjectLayout,
  useUpdateProject,
  type LayoutGroupItem,
  type ProjectPriority,
} from "@/entities/project/index.js";
import { ProjectFormDialog } from "@/features/project-management/index.js";
import { Can, useCan } from "@/features/permissions/index.js";
import { DragPreview } from "./DragPreview.js";
import { GroupDialog } from "./GroupDialog.js";
import { ProjectGroupCard } from "./ProjectGroupCard.js";
import { ProjectRow } from "./ProjectRow.js";

function ListEnd() {
  const { setNodeRef, isOver } = useDroppable({ id: LIST_END });
  return (
    <div
      ref={setNodeRef}
      data-testid="project-list-end"
      data-over={isOver}
      className="min-h-8 flex-1"
    />
  );
}

export function ProjectList() {
  const projectId = useActiveProjectId();
  const navigate = useNavigate();
  const projects = useProjects();
  const clients = useClients();
  const stored = useProjectLayout();
  const save = useSaveProjectLayout();
  const createGroup = useCreateProjectGroup();
  const deleteGroup = useDeleteProjectGroup();
  const [creating, setCreating] = useState(false);
  const [grouping, setGrouping] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<ProjectPriority | "ALL">("ALL");
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const update = useUpdateProject();
  const mayUpdate = useCan("update", "project");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const byId = useMemo(
    () => new Map((projects.data ?? []).map((project) => [project.id, project])),
    [projects.data],
  );

  const layout = useMemo(
    () => arrangeProjects(stored.data ?? EMPTY_LAYOUT, (projects.data ?? []).map(({ id }) => id)),
    [stored.data, projects.data],
  );

  const arrangeable = priorityFilter === "ALL";
  const shown = (id: string) =>
    byId.has(id) && (arrangeable || byId.get(id)?.priority === priorityFilter);

  const editing = projects.data?.find((project) => project.id === editingId);
  const clientName = (id: string) => clients.data?.find((client) => client.id === id)?.name ?? "";

  const activeKind = dragging ? parseDragId(dragging)?.kind ?? null : null;

  const row = (id: string, pinned: boolean) => {
    const project = byId.get(id);
    if (!project) return null;
    return (
      <ProjectRow
        key={id}
        project={project}
        clientName={clientName(project.clientId)}
        selected={project.id === projectId}
        draggable={arrangeable && !pinned}
        pinned={pinned}
        sorting={activeKind === "project"}
        mayUpdate={mayUpdate}
        onOpen={() => { if (project.id !== projectId) navigate(projectPath(project.id)); }}
        onEdit={mayUpdate ? () => setEditingId(project.id) : undefined}
        onPin={() => {
          setProblem(null);
          save.mutate(pinned ? unpinProject(layout, id) : pinProject(layout, id));
        }}
        onPriority={(priority) => update.mutate({ id: project.id, body: { priority } })}
      />
    );
  };

  const removeGroup = (group: LayoutGroupItem) => {
    if (group.projectIds.length > 0) { setProblem(t("projects.group.notEmpty")); return; }
    setProblem(null);
    deleteGroup.mutate(group.groupId);
  };

  const dragged = () => {
    const target = dragging ? parseDragId(dragging) : null;
    if (!target) return {};
    if (target.kind === "project") {
      const project = byId.get(target.id);
      return project ? { project, clientName: clientName(project.clientId) } : {};
    }
    const group = layout.items.find(
      (item) => item.type === "group" && item.groupId === target.id,
    );
    return group?.type === "group" ? { groupName: group.name } : {};
  };

  function handleDragEnd(event: DragEndEvent) {
    setDragging(null);
    const over = event.over;
    if (!over) return;
    const next = moveInLayout(layout, String(event.active.id), String(over.id));
    if (next !== layout) {
      setProblem(null);
      save.mutate(next);
    }
  }

  const pinned = layout.pinned.filter(shown);
  const items = layout.items.filter(
    (item) => item.type === "group" || shown(item.projectId),
  );

  return (
    <>
      <div className="relative flex min-h-0 flex-col gap-2">
        <Select
          value={priorityFilter}
          onValueChange={(value) => setPriorityFilter(value as ProjectPriority | "ALL")}
        >
          <SelectTrigger className="w-full" aria-label={t("projects.priorityFilter")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("projects.allPriorities")}</SelectItem>
            {PROJECT_PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {priorityLabel(priority)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {problem != null && (
          <p role="alert" className="text-xs text-destructive">{problem}</p>
        )}
        {save.isError && (
          <p role="alert" className="text-xs text-destructive">{t("projects.order.failed")}</p>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto pb-12">
          {projects.isPending && (
            <div className="grid place-items-center gap-3 p-6">
              <Loader size="sm" />
            </div>
          )}

          {projects.isError && (
            <div className="grid place-items-center gap-3 p-6">
              <p className="text-sm text-muted-foreground">{t("state.error.title")}</p>
              <Button variant="outline" size="sm" onClick={() => projects.refetch()}>
                {t("state.retry")}
              </Button>
            </div>
          )}

          {projects.isSuccess && projects.data.length === 0 && (
            <EmptyState title={t("projects.empty.title")} />
          )}

          {pinned.length > 0 && (
            <div
              role="group"
              aria-label={t("projects.pinned")}
              className="mb-1 border-b-4 border-border pb-2"
            >
              {pinned.map((id) => row(id, true))}
            </div>
          )}

          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className="flex min-h-16 flex-1 flex-col" data-testid="project-list-area">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
                  onDragStart={(event: DragStartEvent) => setDragging(String(event.active.id))}
                  onDragCancel={() => setDragging(null)}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={items.map((item) => item.type === "project"
                      ? dragId.project(item.projectId)
                      : dragId.group(item.groupId))}
                    strategy={verticalListSortingStrategy}
                  >
                    {items.map((item) => item.type === "project"
                      ? row(item.projectId, false)
                      : (
                        <ProjectGroupCard
                          key={item.groupId}
                          groupId={item.groupId}
                          name={item.name}
                          projectIds={item.projectIds.filter(shown)}
                          draggable={arrangeable}
                          sorting={activeKind === "group"}
                          onDelete={() => removeGroup(item)}
                        >
                          {item.projectIds.filter(shown).map((id) => row(id, false))}
                        </ProjectGroupCard>
                      ))}
                    <ListEnd />
                  </SortableContext>
                  <DragOverlay dropAnimation={null}>
                    <DragPreview {...dragged()} />
                  </DragOverlay>
                </DndContext>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onSelect={() => setGrouping(true)}>
                {t("projects.group.new")}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </div>

        <Can action="create" resource="project">
          <Button
            type="button"
            size="icon"
            className="absolute right-2 bottom-2 z-10 rounded-full shadow-md"
            aria-label={t("projects.new")}
            onClick={() => setCreating(true)}
          >
            <PlusIcon aria-hidden="true" />
          </Button>
        </Can>
      </div>

      {grouping && (
        <GroupDialog
          onClose={() => setGrouping(false)}
          onCreate={(name) => {
            createGroup.mutate(name);
            setGrouping(false);
          }}
        />
      )}

      {creating && (
        <ProjectFormDialog
          onClose={() => setCreating(false)}
          onSaved={(project) => navigate(projectPath(project.id))}
        />
      )}

      {editing != null && (
        <ProjectFormDialog
          project={editing}
          onClose={() => setEditingId(undefined)}
          onDeleted={() => {
            if (editing.id === projectId) navigate(ROUTES.projects, { replace: true });
          }}
        />
      )}
    </>
  );
}
