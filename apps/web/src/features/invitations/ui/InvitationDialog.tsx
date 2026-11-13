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
import { InvitationList } from "./InvitationList.js";
import { PartnerTarget } from "./PartnerTarget.js";
import { useCan } from "@/features/permissions/index.js";
import { cn } from "@/shared/lib/index.js";
import {
  Button,
  CopyButton,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  LABEL_CLASS,
  Loader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
} from "@/shared/ui/index.js";
import { registrationLink } from "../lib/link.js";
import { tariffRefusal } from "@/entities/tariff/index.js";

export interface InvitationDialogProps {
  registrationType: RegistrationType;
  clientId?: string;
  open: boolean;
  onClose: () => void;
}

type Joining = "STAFF" | "PARTNER";

export function InvitationDialog({ registrationType, clientId, open, onClose }: InvitationDialogProps) {
  const projects = useProjects();
  const create = useCreateInvitation();
  const [role, setRole] = useState<EmployeeRole>("MANAGER");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [created, setCreated] = useState<Invitation | null>(null);
  const [joining, setJoining] = useState<Joining>("STAFF");
  const [partnerProjectId, setPartnerProjectId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const invitesPartners = useCan("create", "partner");

  const isEmployee = registrationType === "EMPLOYEE";
  const offersProjects = isEmployee && role !== "ADMIN";
  const needsProjects = isEmployee && role === "GUEST";
  const isJoining = registrationType === "CLIENT_STAFF";
  const offersPartner = isJoining && invitesPartners;
  const isPartner = offersPartner && joining === "PARTNER";
  const clientProjects = (projects.data ?? []).filter((project) => project.clientId === clientId);
  const chosenProject = partnerProjectId || (clientProjects.length === 1 ? clientProjects[0]!.id : "");
  const title = isEmployee
    ? t("invites.createEmployee")
    : isPartner
      ? t("invites.createPartner")
      : isJoining
        ? t("contacts.people.invite")
        : t("invites.createClient");

  function toggleProject(id: string) {
    setProjectIds((current) =>
      current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]);
  }

  function close() {
    setProjectIds([]);
    setFailure(null);
    setCreated(null);
    setJoining("STAFF");
    setPartnerProjectId("");
    setCampaignId("");
    onClose();
  }

  function chooseProject(id: string) {
    setPartnerProjectId(id);
    setCampaignId("");
  }

  async function submit() {
    if (needsProjects && projectIds.length === 0) {
      setFailure(t("invites.projects.required"));
      return;
    }
    if (isPartner && !campaignId) {
      setFailure(t("invites.partner.campaignRequired"));
      return;
    }
    setFailure(null);
    try {
      setCreated(await create.mutateAsync(
        isEmployee
          ? { registrationType: "EMPLOYEE", role, projectIds: offersProjects ? projectIds : [] }
          : isPartner
            ? { registrationType: "PARTNER", campaignId }
            : isJoining
              ? { registrationType: "CLIENT_STAFF", clientId: clientId as string }
              : { registrationType: "CLIENT" },
      ));
    } catch (error) {
      setFailure(tariffRefusal(error) ?? t("invites.failed"));
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
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="invitation-role">{t("invites.role")}</Label>
                  <Select value={role} onValueChange={(next) => setRole(next as EmployeeRole)}>
                    <SelectTrigger id="invitation-role" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EMPLOYEE_ROLES.map((option) => (
                        <SelectItem key={option} value={option}>{t(`role.${option}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {offersProjects && (
                  <fieldset className="flex flex-col gap-2">
                    <legend className={cn(LABEL_CLASS, "mb-2")}>{t("invites.projects")}</legend>
                    {projects.isPending && <Loader label={t("state.loading")} />}
                    <div
                      data-testid="invite-projects"
                      className="grid max-h-58 grid-cols-2 gap-2 overflow-auto"
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
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {offersPartner ? (
                  <Tabs
                    items={[
                      { id: "STAFF", label: t("invites.joining.staff") },
                      { id: "PARTNER", label: t("invites.joining.partner") },
                    ]}
                    activeId={joining}
                    onSelect={(id) => {
                      setJoining(id as Joining);
                      setFailure(null);
                    }}
                    ariaLabel={t("invites.joining")}
                  />
                ) : null}
                {isPartner ? (
                  <PartnerTarget
                    projects={clientProjects}
                    projectId={chosenProject}
                    campaignId={campaignId}
                    onProjectChange={chooseProject}
                    onCampaignChange={setCampaignId}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{t("invites.clientHint")}</p>
                )}
              </div>
            )}

            {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}

            <div className="mt-3 border-t border-border pt-3">
              <InvitationList registrationType={registrationType} />
            </div>
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

function ProjectChoice({
  project, checked, onToggle,
}: { project: Project; checked: boolean; onToggle: () => void }) {
  return (
    <label
      data-testid={`invite-project-${project.id}`}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg border p-2 transition-colors",
        checked
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-muted",
      )}
    >
      <span className="relative grid size-4 shrink-0 place-items-center">
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
            "grid size-4 place-items-center rounded-md border-2 transition-colors",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1",
            checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
          )}
        >
          {checked && <CheckIcon className="size-3" strokeWidth={3} />}
        </span>
      </span>

      <ProjectAvatar project={project} size="sm" />

      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{project.name}</span>
      </span>
    </label>
  );
}

function CreatedStep({ invitation }: { invitation: Invitation }) {
  const link = registrationLink(invitation.registrationUrl);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{t("invites.ready")}</p>
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
        <code className="min-w-0 flex-1 break-all text-sm">{link}</code>
        <CopyButton value={link} label={t("invites.copyLink")} />
      </div>
    </div>
  );
}
