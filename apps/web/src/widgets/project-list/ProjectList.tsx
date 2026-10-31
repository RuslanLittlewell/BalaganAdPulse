import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDownIcon, PlusIcon, SearchIcon } from "lucide-react";
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
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  EmptyState,
  Hint,
  Input,
  Loader,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import {
  cn,
  projectPath,
  ROUTES,
  useDebouncedValue,
  useNarrowScreen,
} from "@/shared/lib/index.js";
import { WarmTooltipGroup } from "@/shared/ui/WarmTooltip/WarmTooltip.js";
import { useClients } from "@/entities/client/index.js";
import {
  EMPTY_LAYOUT,
  LIST_END,
  arrangeProjects,
  dragId,
  moveInLayout,
  parseDragId,
  pinProject,
  ProjectAvatar,
  unpinProject,
  useActiveProjectId,
  useCreateProjectGroup,
  useDeleteProjectGroup,
  useProjectLayout,
  useProjects,
  useSaveProjectLayout,
  type LayoutGroupItem,
} from "@/entities/project/index.js";
import { useProjectsSummary } from "@/entities/campaign/index.js";
import { ProjectFormDialog } from "@/features/project-management/index.js";
import { Can, useCan } from "@/features/permissions/index.js";
import { HINTS, useHint } from "@/features/hints/index.js";
import { usePeriod } from "@/features/period/index.js";
import { DragPreview } from "./DragPreview.js";
import { GroupDialog } from "./GroupDialog.js";
import { ProjectGroupCard } from "./ProjectGroupCard.js";
import { ProjectRow } from "./ProjectRow.js";
import { projectTone, type ProjectTone } from "./projectTone.js";

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

const SEARCH_DELAY_MS = 300;

const normalised = (text: string) => text.trim().toLocaleLowerCase("ru");

function useProjectTones(): (projectId: string) => ProjectTone {
  const { range } = usePeriod();
  const summary = useProjectsSummary(range);
  return useMemo(() => {
    const tones = new Map(
      (summary.data ?? []).map((figures) => [
        figures.projectId,
        projectTone(figures, range),
      ]),
    );
    return (projectId) => tones.get(projectId) ?? "none";
  }, [summary.data, range]);
}

export function ProjectList({ collapsed = false }: { collapsed?: boolean }) {
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
  const [search, setSearch] = useState("");
  const query = normalised(useDebouncedValue(search, SEARCH_DELAY_MS));
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const narrow = useNarrowScreen("lg");
  const folded = collapsed && !narrow;
  const [picking, setPicking] = useState(false);
  const toneOf = useProjectTones();
  const mayUpdate = useCan("update", "project");
  const mayCreate = useCan("create", "project");
  const firstProject = useHint(
    HINTS.projectsFirstProject,
    mayCreate && projects.isSuccess && projects.data.length === 0 && !creating,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const byId = useMemo(
    () =>
      new Map((projects.data ?? []).map((project) => [project.id, project])),
    [projects.data],
  );

  const layout = useMemo(
    () =>
      arrangeProjects(
        stored.data ?? EMPTY_LAYOUT,
        (projects.data ?? []).map(({ id }) => id),
      ),
    [stored.data, projects.data],
  );

  const editing = projects.data?.find((project) => project.id === editingId);
  const clientName = (id: string) =>
    clients.data?.find((client) => client.id === id)?.name ?? "";

  const searching = query !== "";
  const arrangeable = !searching && !folded;
  const shown = (id: string) => {
    const project = byId.get(id);
    if (!project) return false;
    if (!searching) return true;
    return [project.name, clientName(project.clientId)].some((text) =>
      normalised(text).includes(query),
    );
  };

  const activeKind = dragging ? (parseDragId(dragging)?.kind ?? null) : null;

  const row = (id: string, pinned: boolean) => {
    const project = byId.get(id);
    if (!project) return null;
    return (
      <ProjectRow
        key={id}
        project={project}
        clientName={clientName(project.clientId)}
        tone={toneOf(project.id)}
        selected={project.id === projectId}
        draggable={arrangeable && !pinned}
        pinned={pinned}
        collapsed={folded}
        sorting={activeKind === "project"}
        onOpen={() => {
          setPicking(false);
          if (project.id !== projectId) navigate(projectPath(project.id));
        }}
        onEdit={mayUpdate ? () => setEditingId(project.id) : undefined}
        onPin={() => {
          setProblem(null);
          save.mutate(
            pinned ? unpinProject(layout, id) : pinProject(layout, id),
          );
        }}
      />
    );
  };

  const removeGroup = (group: LayoutGroupItem) => {
    if (group.projectIds.length > 0) {
      setProblem(t("projects.group.notEmpty"));
      return;
    }
    setProblem(null);
    deleteGroup.mutate(group.groupId);
  };

  const dragged = () => {
    const target = dragging ? parseDragId(dragging) : null;
    if (!target) return {};
    if (target.kind === "project") {
      const project = byId.get(target.id);
      return project
        ? {
            project,
            clientName: clientName(project.clientId),
            tone: toneOf(project.id),
          }
        : {};
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
  const items = layout.items.filter((item) =>
    item.type === "group"
      ? !searching || item.projectIds.some(shown)
      : shown(item.projectId),
  );
  const searchField = (
    <div className="relative">
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        className="pl-9 focus-visible:ring-0"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("projects.search.placeholder")}
        aria-label={t("projects.search")}
      />
    </div>
  );
  const nothingFound =
    searching &&
    projects.isSuccess &&
    pinned.length === 0 &&
    items.length === 0;

  const chosen = projectId ? byId.get(projectId) : undefined;

  const panel = (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2">
      {folded ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant={searching ? "secondary" : "ghost"}
              size="icon"
              className="self-center"
              aria-label={t("projects.search")}
            >
              <SearchIcon aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className="w-64 p-1">
            {searchField}
          </PopoverContent>
        </Popover>
      ) : (
        searchField
      )}

      {problem != null && (
        <p role="alert" className="text-xs text-destructive">
          {problem}
        </p>
      )}
      {save.isError && (
        <p role="alert" className="text-xs text-destructive">
          {t("projects.order.failed")}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto pb-12">
        {projects.isPending && (
          <div className="grid place-items-center gap-3 p-6">
            <Loader size="sm" />
          </div>
        )}

        {projects.isError && (
          <div className="grid place-items-center gap-3 p-6">
            <p className="text-sm text-muted-foreground">
              {t("state.error.title")}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => projects.refetch()}
            >
              {t("state.retry")}
            </Button>
          </div>
        )}

        {projects.isSuccess && projects.data.length === 0 && (
          <EmptyState compact title={t("projects.empty.title")} />
        )}

        {nothingFound && projects.data.length > 0 && (
          <EmptyState compact title={t("projects.search.empty")} />
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
            <div
              className="flex min-h-16 flex-1 flex-col"
              data-testid="project-list-area"
            >
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                measuring={{
                  droppable: { strategy: MeasuringStrategy.Always },
                }}
                onDragStart={(event: DragStartEvent) =>
                  setDragging(String(event.active.id))
                }
                onDragCancel={() => setDragging(null)}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={items.map((item) =>
                    item.type === "project"
                      ? dragId.project(item.projectId)
                      : dragId.group(item.groupId),
                  )}
                  strategy={verticalListSortingStrategy}
                >
                  {items.map((item) =>
                    item.type === "project" ? (
                      row(item.projectId, false)
                    ) : (
                      <ProjectGroupCard
                        key={item.groupId}
                        groupId={item.groupId}
                        name={item.name}
                        projectIds={item.projectIds.filter(shown)}
                        draggable={arrangeable}
                        collapsed={folded}
                        sorting={activeKind === "group"}
                        onDelete={() => removeGroup(item)}
                      >
                        {item.projectIds
                          .filter(shown)
                          .map((id) => row(id, false))}
                      </ProjectGroupCard>
                    ),
                  )}
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
        <Hint
          open={firstProject.open}
          text={t("hint.projects.firstProject")}
          side="top"
          onDismiss={firstProject.dismiss}
        >
          <Button
            type="button"
            size="icon"
            className={cn(
              "absolute bottom-2 z-10 rounded-full shadow-md",
              folded ? "left-1/2 -translate-x-1/2" : "right-2",
            )}
            aria-label={t("projects.new")}
            onClick={() => setCreating(true)}
          >
            <PlusIcon aria-hidden="true" />
          </Button>
        </Hint>
      </Can>
    </div>
  );

  return (
    <>
      <WarmTooltipGroup>
        {narrow ? (
          <Popover open={picking} onOpenChange={setPicking}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={chosen ? `${t("projects.list.open")}: ${chosen.name}` : t("projects.list.open")}
                className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left shadow-xs transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {chosen ? <ProjectAvatar project={chosen} size="sm" /> : null}
                <span className="grid min-w-0 flex-1">
                  <span className="truncate text-sm font-medium">
                    {chosen?.name ?? t("projects.list.choose")}
                  </span>
                  {chosen ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {clientName(chosen.clientId)}
                    </span>
                  ) : null}
                </span>
                <ChevronDownIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              aria-label={t("projects.list.open")}
              className="flex h-[min(70dvh,32rem)] w-(--radix-popover-trigger-width) flex-col p-2"
            >
              {panel}
            </PopoverContent>
          </Popover>
        ) : (
          panel
        )}
      </WarmTooltipGroup>

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
            if (editing.id === projectId)
              navigate(ROUTES.projects, { replace: true });
          }}
        />
      )}
    </>
  );
}
