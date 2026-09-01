import { useState } from "react";
import type { Role } from "@adpulse/access-policy";
import { CopyIcon, HistoryIcon, Trash2Icon, XIcon } from "lucide-react";
import {
  useCreateInvitation,
  useInvitations,
  useRevokeInvitation,
} from "@/entities/invitation/index.js";
import {
  useDeleteMember,
  useMembers,
  useUpdateMember,
  type Membership,
} from "@/entities/membership/index.js";
import { Can, useCan } from "@/features/permissions/index.js";
import { t } from "@/shared/config/index.js";
import { Button, ConfirmDialog, Loader } from "@/shared/ui/index.js";
import { ActivityLogModal } from "@/widgets/activity-log-modal/index.js";

const ROLE_OPTIONS: Role[] = ["ADMIN", "MANAGER", "GUEST", "CLIENT"];

function roleLabel(role: Role) {
  return t(`role.${role}`);
}

function MemberRow({ member }: { member: Membership }) {
  const updateMember = useUpdateMember();
  const deleteMember = useDeleteMember();
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const pending = updateMember.isPending || deleteMember.isPending;

  return (
    <li className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <p className="truncate font-medium">{member.name}</p>
        <p className="truncate text-sm text-muted-foreground">{member.email}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t(`membership.status.${member.status}`)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Can action="update" resource="member">
          <select
            aria-label={`${t("team.role")} ${member.name}`}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
            value={member.role}
            disabled={pending}
            onChange={(event) => void updateMember.mutateAsync({
              id: member.id,
              body: { role: event.target.value as Role },
            })}
          >
            {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
          </select>
        </Can>

        <Can action="update" resource="member">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            aria-label={`${member.status === "ACTIVE" ? t("team.suspend") : t("team.activate")} ${member.name}`}
            onClick={() => void updateMember.mutateAsync({
              id: member.id,
              body: { status: member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" },
            })}
          >
            {member.status === "ACTIVE" ? t("team.suspend") : t("team.activate")}
          </Button>
        </Can>

        <Can action="delete" resource="member">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${t("action.delete")} ${member.name}`}
            disabled={pending}
            onClick={() => setConfirmingRemoval(true)}
          >
            <Trash2Icon aria-hidden="true" />
          </Button>
        </Can>
      </div>

      <ConfirmDialog
        open={confirmingRemoval}
        title={t("team.remove.title")}
        description={t("team.remove.description")}
        confirmLabel={t("team.remove.confirm")}
        pending={deleteMember.isPending}
        onClose={() => setConfirmingRemoval(false)}
        onConfirm={() => void deleteMember.mutateAsync(member.id).then(() => setConfirmingRemoval(false))}
      />
    </li>
  );
}

function MemberList() {
  const members = useMembers();

  if (members.isPending) return <Loader label={t("state.loading")} />;
  if (members.isError) return <p className="text-sm text-destructive">{t("team.loadFailed")}</p>;
  if (members.data.length === 0) return <p className="text-sm text-muted-foreground">{t("team.empty")}</p>;

  return <ul className="grid gap-3">{members.data.map((member) => <MemberRow key={member.id} member={member} />)}</ul>;
}

function InvitationPanel() {
  const invitations = useInvitations();
  const createInvitation = useCreateInvitation();
  const revokeInvitation = useRevokeInvitation();
  const [role, setRole] = useState<Role>("MANAGER");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const pending = invitations.data?.filter((invitation) => invitation.status === "PENDING") ?? [];

  const copy = (code: string) => {
    if (navigator.clipboard) void navigator.clipboard.writeText(code);
  };

  return (
    <section className="mt-10 border-t border-border pt-6" aria-labelledby="invitations-title">
      <h2 id="invitations-title" className="text-xl font-semibold">{t("invites.title")}</h2>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="invitation-role">{t("invites.role")}</label>
        <select
          id="invitation-role"
          aria-label={t("invites.role")}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
        >
          {ROLE_OPTIONS.map((option) => <option key={option} value={option}>{roleLabel(option)}</option>)}
        </select>
        <Can action="create" resource="invite">
          <Button
            disabled={createInvitation.isPending}
            onClick={() => void createInvitation.mutateAsync({ role }).then((created) => {
              setCreatedCode(created.code);
            })}
          >
            {t("invites.create")}
          </Button>
        </Can>
      </div>

      {createdCode && (
        <div className="mt-4 flex items-center gap-2 rounded-md bg-muted p-3">
          <code className="min-w-0 flex-1 break-all text-sm">{createdCode}</code>
          <Button variant="ghost" size="icon-sm" aria-label={t("invites.copy")} onClick={() => copy(createdCode)}>
            <CopyIcon aria-hidden="true" />
          </Button>
        </div>
      )}

      {invitations.isPending && <div className="mt-4"><Loader label={t("state.loading")} /></div>}
      {invitations.isError && <p className="mt-4 text-sm text-destructive">{t("invites.loadFailed")}</p>}
      {invitations.isSuccess && (
        pending.length === 0
          ? <p className="mt-4 text-sm text-muted-foreground">{t("invites.empty")}</p>
          : (
            <ul className="mt-4 grid gap-2">
              {pending.map((invitation) => (
                <li key={invitation.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                  <code className="min-w-0 flex-1 break-all text-sm">{invitation.code}</code>
                  <span className="text-sm text-muted-foreground">{roleLabel(invitation.role)}</span>
                  <Button variant="ghost" size="icon-sm" aria-label={t("invites.copy")} onClick={() => copy(invitation.code)}>
                    <CopyIcon aria-hidden="true" />
                  </Button>
                  <Can action="delete" resource="invite">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={revokeInvitation.isPending}
                      aria-label={`${t("invites.revoke")} ${invitation.code}`}
                      onClick={() => void revokeInvitation.mutateAsync(invitation.id)}
                    >
                      <XIcon aria-hidden="true" />
                    </Button>
                  </Can>
                </li>
              ))}
            </ul>
          )
      )}
    </section>
  );
}

export function TeamPage() {
  const mayReadMembers = useCan("read", "member");
  const [activityOpen, setActivityOpen] = useState(false);

  if (!mayReadMembers) {
    return <p className="text-sm text-muted-foreground">{t("permission.denied")}</p>;
  }

  return (
    <section className="mx-auto w-full max-w-5xl">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div><h1 className="text-2xl font-bold">{t("team.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("team.description")}</p></div>
        <Can action="read" resource="audit">
          <Button variant="outline" onClick={() => setActivityOpen(true)}>
            <HistoryIcon /> {t("activity.title")}
          </Button>
        </Can>
      </header>
      <MemberList />
      <Can action="read" resource="invite">
        <InvitationPanel />
      </Can>
      <ActivityLogModal open={activityOpen} onOpenChange={setActivityOpen} />
    </section>
  );
}
