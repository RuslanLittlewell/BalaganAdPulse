import { useState } from "react";
import { CheckIcon } from "lucide-react";
import {
  EMPLOYEE_ROLES,
  useCreateInvitation,
  type EmployeeRole,
  type Invitation,
  type RegistrationType,
} from "@/entities/invitation/index.js";
import { ProjectAvatar, useProjects, type Project } from "@/entities/project/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import {
  Button,
  CopyButton,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Loader,
} from "@/shared/ui/index.js";
import { registrationLink } from "../lib/link.js";

export interface InvitationDialogProps {
  registrationType: RegistrationType;
  open: boolean;
  onClose: () => void;
}

/**
 * The invitation form, in a dialog of its own over the contact book.
 *
 * Two steps: what to invite, and then the link it produced. The link is the
 * whole point of creating an invitation and exists only once the server has
 * answered — closing on success would leave the person who asked for it hunting
 * through the list to find what they just made.
 */
export function InvitationDialog({ registrationType, open, onClose }: InvitationDialogProps) {
  const projects = useProjects();
  const create = useCreateInvitation();
  const [role, setRole] = useState<EmployeeRole>("MANAGER");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [created, setCreated] = useState<Invitation | null>(null);

  const isEmployee = registrationType === "EMPLOYEE";
  const title = isEmployee ? t("invites.createEmployee") : t("invites.createClient");

  function toggleProject(id: string) {
    setProjectIds((current) =>
      current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]);
  }

  function close() {
    // Reset here rather than on open: reopening must offer a blank form, and
    // the dialog is unmounted in between only by the parent's own state.
    setProjectIds([]);
    setFailure(null);
    setCreated(null);
    onClose();
  }

  async function submit() {
    // Checked here as well as on the server: without it the button appears to
    // do nothing, and the round trip explains less than this does.
    if (isEmployee && projectIds.length === 0) {
      setFailure(t("invites.projects.required"));
      return;
    }
    setFailure(null);
    try {
      setCreated(await create.mutateAsync(
        isEmployee
          ? { registrationType: "EMPLOYEE", role, projectIds }
          : { registrationType: "CLIENT" },
      ));
    } catch {
      setFailure(t("invites.failed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="w-[min(640px,calc(100vw-2rem))] max-w-none">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {created ? (
          <CreatedStep invitation={created} />
        ) : (
          <>
            {isEmployee ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium" htmlFor="invitation-role">
                    {t("invites.role")}
                  </label>
                  <select
                    id="invitation-role"
                    aria-label={t("invites.role")}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={role}
                    onChange={(event) => setRole(event.target.value as EmployeeRole)}
                  >
                    {EMPLOYEE_ROLES.map((option) => (
                      <option key={option} value={option}>{t(`role.${option}`)}</option>
                    ))}
                  </select>
                </div>

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm font-medium">{t("invites.projects")}</legend>
                  {projects.isPending && <Loader label={t("state.loading")} />}
                  <div
                    data-testid="invite-projects"
                    className="grid max-h-72 grid-cols-2 gap-2 overflow-auto"
                  >
                    {(projects.data ?? []).map((project) => (
                      <ProjectChoice
                        key={project.id}
                        project={project}
                        checked={projectIds.includes(project.id)}
                        onToggle={() => toggleProject(project.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("invites.clientHint")}</p>
            )}

            {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
          </>
        )}

        <DialogFooter>
          {created ? (
            <Button type="button" onClick={close}>{t("invites.done")}</Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={close}>{t("action.cancel")}</Button>
              <Button type="button" disabled={create.isPending} onClick={() => void submit()}>
                {t("invites.submit")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One project, as a card the whole of which is the control. */
function ProjectChoice({
  project, checked, onToggle,
}: { project: Project; checked: boolean; onToggle: () => void }) {
  return (
    <label
      data-testid={`invite-project-${project.id}`}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
        checked
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-muted",
      )}
    >
      {/* The native input carries the state and the label, and is drawn over by
          the box beside it — a checkbox styled directly cannot show a tick
          consistently across browsers, and hiding it outright would take the
          control away from anyone navigating by keyboard. */}
      <span className="relative grid size-5 shrink-0 place-items-center">
        <input
          type="checkbox"
          aria-label={project.name}
          checked={checked}
          onChange={onToggle}
          className="peer absolute size-full cursor-pointer opacity-0"
        />
        <span
          aria-hidden
          className={cn(
            "grid size-5 place-items-center rounded-md border-2 transition-colors",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1",
            checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
          )}
        >
          {checked && <CheckIcon className="size-3.5" strokeWidth={3} />}
        </span>
      </span>

      <ProjectAvatar project={project} size="sm" />

      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{project.name}</span>
        {project.niche && (
          <span className="truncate text-xs text-muted-foreground">{project.niche}</span>
        )}
      </span>
    </label>
  );
}

/** The link the invitation produced, ready to be sent to somebody. */
function CreatedStep({ invitation }: { invitation: Invitation }) {
  const link = registrationLink(invitation.registrationUrl);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{t("invites.ready")}</p>
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3">
        <code className="min-w-0 flex-1 break-all text-sm">{link}</code>
        <CopyButton value={link} label={t("invites.copyLink")} />
      </div>
    </div>
  );
}
