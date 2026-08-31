import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

/** The projects of the Projects module, each labelled with the company it is for. */
export function ProjectList() {
  const projectId = useActiveProjectId();
  const navigate = useNavigate();
  const projects = useProjects();
  const clients = useClients();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const update = useUpdateProject();

  const editing = projects.data?.find((project) => project.id === editingId);
  const clientName = (id: string) =>
    clients.data?.find((client) => client.id === id)?.name ?? "";

  return (
    <>
      <div className="flex min-h-0 flex-col gap-2">
        <Button
          variant="outline"
          className="w-full border-dashed border-primary text-primary"
          onClick={() => setCreating(true)}
        >
          + {t("projects.new")}
        </Button>

        <div className="flex min-h-0 flex-col gap-1 overflow-auto">
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
            projects.data.map((project) => (
              // Right-click anywhere on the row picks its priority.
              <ContextMenu key={project.id}>
                <ContextMenuTrigger>
                  <ListItem
                    selected={project.id === projectId}
                    leading={<ProjectAvatar project={project} size="sm" />}
                    marker={priorityColour(project.priority)}
                    markerLabel={`${t("priority.title")}: ${priorityLabel(project.priority)}`}
                    onEdit={() => setEditingId(project.id)}
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
                <ContextMenuContent>
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
                </ContextMenuContent>
              </ContextMenu>
            ))}
        </div>
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
            // Leaving the open project deleted would strand the route on it.
            if (editing.id === projectId) navigate(ROUTES.projects, { replace: true });
          }}
        />
      )}
    </>
  );
}
