import { useState } from "react";
import { XIcon } from "lucide-react";
import {
  ConfirmDialog,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/index.js";
import { cn } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { ProjectAvatar, useProjects, type Project } from "@/entities/project/index.js";
import {
  useMemberAccess,
  useSetMemberAccess,
  type ClientAccessGrant,
} from "@/entities/membership/index.js";
import { useCan } from "@/features/permissions/index.js";

interface ReachedProject {
  grant: ClientAccessGrant;
  project: Project;
  removable: boolean;
}

function reachedProjects(grants: readonly ClientAccessGrant[], projects: readonly Project[]): ReachedProject[] {
  const named = grants.flatMap((grant) => {
    const project = grant.projectId ? projects.find((candidate) => candidate.id === grant.projectId) : undefined;
    return project ? [{ grant, project, removable: true }] : [];
  });
  const namedIds = new Set(named.map(({ project }) => project.id));
  const covered = grants
    .filter((grant) => grant.projectId == null)
    .flatMap((grant) => projects
      .filter((project) => project.clientId === grant.clientId && !namedIds.has(project.id))
      .map((project) => ({ grant, project, removable: false })));
  return [...named, ...covered];
}

export function EmployeeAccess({ membershipId }: { membershipId: string }) {
  const grants = useMemberAccess(membershipId);
  const projects = useProjects();
  const setAccess = useSetMemberAccess();
  const mayChange = useCan("update", "member");
  const [removing, setRemoving] = useState<{
    grant: ClientAccessGrant;
    label: string;
  } | null>(null);

  const held = grants.data ?? [];
  const projectOf = (id: string) =>
    projects.data?.find((project) => project.id === id);

  const stated = (grant: ClientAccessGrant) => ({
    clientId: grant.clientId,
    projectId: grant.projectId ?? null,
  });

  const reached = reachedProjects(held, projects.data ?? []);
  const granted = new Set(reached.map(({ project }) => project.id));
  const available = (projects.data ?? []).filter(
    (project) => !granted.has(project.id),
  );

  function replaceWith(next: ClientAccessGrant[]) {
    setAccess.mutate({
      id: membershipId,
      grants: next.map(stated) as ClientAccessGrant[],
    });
  }

  return (
    <section
      className="mt-3 border-t border-border pt-3"
      data-testid="employee-access"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-medium text-muted-foreground">
          {t("employee.access")}
        </h4>
        {mayChange && available.length > 0 && (
          <Select
            value=""
            onValueChange={(projectId) => {
              const project = projectOf(projectId);
              if (!project) return;
              replaceWith([...held, { clientId: project.clientId, projectId }]);
            }}
          >
            <SelectTrigger
              className="h-6 w-38"
              aria-label={t("employee.access.add")}
            >
              <SelectValue placeholder={t("employee.access.add")} />
            </SelectTrigger>
            <SelectContent>
              {available.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  <span className="flex min-w-0 items-center gap-2">
                    <ProjectAvatar project={project} size="sm" />
                    <span className="truncate">{project.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {reached.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {t("employee.access.none")}
        </p>
      ) : (
        <ul className="mt-2 flex flex-row flex-wrap gap-1">
          {reached.map(({ grant, project, removable }) => {
            const label = project.name;

            return (
              <li
                key={project.id}
                className="group relative flex min-w-0 items-center gap-2 rounded-md bg-muted/50 px-2 py-1"
              >
                {mayChange && removable && (
                  <button
                    type="button"
                    aria-label={`${t("employee.access.remove")} ${label}`}
                    className={cn(
                      "absolute -right-1 -top-1 grid size-3 place-items-center rounded-full",
                      "bg-destructive text-white shadow-sm transition-opacity",
                      "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                    onClick={() => setRemoving({ grant, label })}
                  >
                    <XIcon aria-hidden className="size-2" />
                  </button>
                )}

                <span className="relative shrink-0">
                  <ProjectAvatar project={project} size="sm" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={removing != null}
        title={t("employee.access.remove.title")}
        description={
          removing == null
            ? ""
            : `${t("employee.access.remove.body")} ${removing.label}`
        }
        confirmLabel={t("employee.access.remove.confirm")}
        onConfirm={() => {
          if (removing == null) return;
          replaceWith(held.filter((one) => one !== removing.grant));
          setRemoving(null);
        }}
        onClose={() => setRemoving(null)}
      />
    </section>
  );
}
