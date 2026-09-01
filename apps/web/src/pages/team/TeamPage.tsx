import { useState } from "react";
import type { Role } from "@adpulse/access-policy";
import { Trash2Icon } from "lucide-react";
import {
  useDeleteMember,
  useMembers,
  useUpdateMember,
  type Membership,
} from "@/entities/membership/index.js";
import { useAuth } from "@/features/auth/index.js";
import { Can, useCan } from "@/features/permissions/index.js";
import { t } from "@/shared/config/index.js";
import { Button, ConfirmDialog, Loader } from "@/shared/ui/index.js";

const ROLE_OPTIONS: Role[] = ["ADMIN", "MANAGER", "GUEST", "CLIENT"];

function roleLabel(role: Role) {
  return t(`role.${role}`);
}

function MemberRow({ member }: { member: Membership }) {
  const { user } = useAuth();
  const updateMember = useUpdateMember();
  const deleteMember = useDeleteMember();
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const pending = updateMember.isPending || deleteMember.isPending;
  // The API refuses this with a conflict whatever the interface shows; hiding
  // the control keeps an admin from discovering the rule by pressing a button
  // that looked available. Matched on the account, which is what the session
  // and the member list have in common — the membership id is not in the
  // session payload.
  const isSelf = user?.id === member.userId;

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

        {isSelf ? null : (
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
        )}
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

export function TeamPage() {
  const mayReadMembers = useCan("read", "member");

  if (!mayReadMembers) {
    return <p className="text-sm text-muted-foreground">{t("permission.denied")}</p>;
  }

  return (
    <section className="mx-auto w-full max-w-5xl">
      <header className="mb-6">
        <div><h1 className="text-2xl font-bold">{t("team.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("team.description")}</p></div>
      </header>
      <MemberList />
    </section>
  );
}
