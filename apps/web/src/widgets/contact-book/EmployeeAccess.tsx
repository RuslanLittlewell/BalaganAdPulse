import { useState } from "react";
import { XIcon } from "lucide-react";
import {
  ConfirmDialog, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/ui/index.js";
import { cn } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { useClients } from "@/entities/client/index.js";
import { ProjectAvatar, useProjects } from "@/entities/project/index.js";
import {
  useMemberAccess, useSetMemberAccess, type ClientAccessGrant,
} from "@/entities/membership/index.js";
import { useCan } from "@/features/permissions/index.js";

export function EmployeeAccess({ membershipId }: { membershipId: string }) {
  const grants = useMemberAccess(membershipId);
  const projects = useProjects();
  const clients = useClients();
  const setAccess = useSetMemberAccess();
  const mayChange = useCan("update", "member");
  const [removing, setRemoving] = useState<{ grant: ClientAccessGrant; label: string } | null>(null);

  const held = grants.data ?? [];
  const projectOf = (id: string) => projects.data?.find((project) => project.id === id);
  const clientOf = (id: string) => clients.data?.find((client) => client.id === id);

  const stated = (grant: ClientAccessGrant) => ({
    clientId: grant.clientId,
    projectId: grant.projectId ?? null,
  });

  const granted = new Set(held.map((grant) => grant.projectId).filter(Boolean));
  const available = (projects.data ?? []).filter((project) => !granted.has(project.id));

  function replaceWith(next: ClientAccessGrant[]) {
    setAccess.mutate({ id: membershipId, grants: next.map(stated) as ClientAccessGrant[] });
  }

  return (
    <section className="mt-4 border-t border-border pt-4" data-testid="employee-access">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
            <SelectTrigger className="h-8 w-48" aria-label={t("employee.access.add")}>
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

      {held.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("employee.access.none")}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {held.map((grant) => {
            const project = grant.projectId ? projectOf(grant.projectId) : undefined;
            const wholeClient = grant.projectId == null;
            const label = wholeClient
              ? `${clientOf(grant.clientId)?.name ?? ""} — ${t("employee.access.wholeClient")}`
              : project?.name ?? "";

            return (
              <li
                key={grant.id ?? `${grant.clientId}:${grant.projectId}`}
                className="group relative flex min-w-0 items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5"
              >
                <span className="relative shrink-0">
                  {project ? <ProjectAvatar project={project} size="sm" /> : null}
                  {mayChange && !wholeClient && (
                    <button
                      type="button"
                      aria-label={`${t("employee.access.remove")} ${label}`}
                      className={cn(
                        "absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full",
                        "bg-destructive text-white shadow-sm transition-opacity",
                        "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                      onClick={() => setRemoving({ grant, label })}
                    >
                      <XIcon aria-hidden className="size-2.5" />
                    </button>
                  )}
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
        description={removing == null
          ? ""
          : `${t("employee.access.remove.body")} ${removing.label}`}
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
