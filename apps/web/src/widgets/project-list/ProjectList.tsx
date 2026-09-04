import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlusIcon } from "lucide-react";
import {
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuTrigger,
  EmptyState,
  ListItem,
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
  PROJECT_PRIORITIES,
  ProjectAvatar,
  priorityColour,
  priorityLabel,
  useActiveProjectId,
  useProjects,
  useUpdateProject,
  type ProjectPriority,
} from "@/entities/project/index.js";
import { ProjectFormDialog } from "@/features/project-management/index.js";
import { Can, useCan } from "@/features/permissions/index.js";

export function ProjectList() {
  const projectId = useActiveProjectId();
  const navigate = useNavigate();
  const projects = useProjects();
  const clients = useClients();
  const [creating, setCreating] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<ProjectPriority | "ALL">("ALL");
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const update = useUpdateProject();
  const mayUpdate = useCan("update", "project");

  const visibleProjects = [...(projects.data ?? [])]
    .filter((project) => priorityFilter === "ALL" || project.priority === priorityFilter)
    .sort(
      (left, right) =>
        PROJECT_PRIORITIES.indexOf(left.priority) - PROJECT_PRIORITIES.indexOf(right.priority),
    );

  const editing = projects.data?.find((project) => project.id === editingId);
  const clientName = (id: string) =>
    clients.data?.find((client) => client.id === id)?.name ?? "";

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

        <div className="flex min-h-0 flex-col gap-1 overflow-auto pb-12">
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

          {projects.isSuccess &&
            visibleProjects.map((project) => (
              <ContextMenu key={project.id}>
                <ContextMenuTrigger>
                  <ListItem
                    selected={project.id === projectId}
                    leading={<ProjectAvatar project={project} size="sm" />}
                    marker={priorityColour(project.priority)}
                    markerLabel={`${t("priority.title")}: ${priorityLabel(project.priority)}`}
                    onEdit={mayUpdate ? () => setEditingId(project.id) : undefined}
                    editLabel={`${t("project.edit")}: ${project.name}`}
                    onClick={() => {
                      if (project.id !== projectId) navigate(projectPath(project.id));
                    }}
                  >
                    <span className="grid min-w-0 text-left">
                      <span className="truncate">{project.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {clientName(project.clientId)}
                      </span>
                    </span>
                  </ListItem>
                </ContextMenuTrigger>
                {mayUpdate && <ContextMenuContent>
                  <ContextMenuLabel>{t("priority.title")}</ContextMenuLabel>
                  <ContextMenuRadioGroup
                    value={project.priority}
                    onValueChange={(priority) =>
                      update.mutate({
                        id: project.id,
                        body: { priority: priority as ProjectPriority },
                      })
                    }
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
                </ContextMenuContent>}
              </ContextMenu>
            ))}
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
