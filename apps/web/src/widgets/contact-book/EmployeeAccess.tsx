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

/**
 * What one colleague can reach, and — for an admin — a way to change it.
 *
 * The endpoint replaces the whole set, which is the right shape for editing one:
 * this reads what is there, applies a single change and sends all of it back. Two
 * admins editing at once therefore do not merge into a state neither chose; the
 * later write wins entirely, which is at least one somebody picked.
 */
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

  /** What the endpoint stores: the grant without its own identity. */
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
            // A grant naming a client and no project covers every project of it,
            // and is decided where clients are — not from a row about one.
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
                      // Always reachable by keyboard and always there for a
                      // pointer; only the paint waits for hover, so it is not
                      // hidden from anyone navigating without a mouse.
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

      {/* Asked before it acts. Granting shows somebody more than they saw;
          removing takes away work they may be in the middle of, from a row that
          looks like every other, and the result is invisible until somebody
          complains. */}
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
