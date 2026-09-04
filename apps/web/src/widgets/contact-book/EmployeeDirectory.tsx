import { useState } from "react";
import { MemberAvatar, useMembers, type Membership } from "@/entities/membership/index.js";
import { EmployeeAccess } from "./EmployeeAccess.js";
import { useAuth } from "@/features/auth/index.js";
import { t } from "@/shared/config/index.js";
import { EmptyState, ListItem, Loader } from "@/shared/ui/index.js";

/**
 * The organization's people, and the invitations that will add more.
 *
 * Read-only on purpose: roles, suspension and removal stay on the Team page,
 * which is about administering members. This pane is the contact book's other
 * half — who they are, and how to invite the next one.
 */
export function EmployeeDirectory() {
  const members = useMembers();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string>();
  /* Nobody opens a directory to find themselves, and their own row is the one
     whose grants an admin should not change in passing. Filtered here rather
     than in the listing: the same answer feeds the control that makes somebody
     responsible for a task, and taking one yourself is the ordinary case. */
  const list = (members.data ?? []).filter((member) => member.userId !== user?.id);
  const selected = list.find((member) => member.id === selectedId) ?? list[0];

  if (members.isPending) {
    return <div className="grid place-items-center py-10"><Loader /></div>;
  }

  return (
    <div className="grid min-h-[22rem] gap-4 sm:grid-cols-[30%_minmax(0,1fr)]">
      <div className="flex max-h-[60vh] flex-col gap-1 overflow-auto sm:pr-4">
        {list.map((member) => (
          <ListItem
            key={member.id}
            selected={member.id === selected?.id}
            leading={<MemberAvatar member={member} size="sm" />}
            onClick={() => setSelectedId(member.id)}
          >
            {member.name}
          </ListItem>
        ))}
        {list.length === 0 && <EmptyState title={t("contacts.employees.empty")} />}
      </div>

      <div className="max-h-[60vh] min-w-0 overflow-auto sm:border-l sm:border-border sm:pl-4">
        {selected && <EmployeeDetails member={selected} />}
        {selected && <EmployeeAccess membershipId={selected.id} />}
      </div>
    </div>
  );
}

/** One label and value to a row, separated — the same shape the client pane
 * uses, so the two halves of the book read alike. */
function EmployeeDetails({ member }: { member: Membership }) {
  const rows = [
    ["fullName", t("contacts.fullName"), member.name],
    ["email", t("contacts.email"), member.email],
    ["phone", t("contacts.phone"), member.phone ?? "—"],
    ["telegram", t("contacts.telegram"), member.telegram ?? "—"],
    ["role", t("team.role"), t(`role.${member.role}`)],
  ] as const;

  return (
    <dl className="divide-y divide-border" data-testid="employee-details">
      {rows.map(([key, label, value]) => (
        <div
          key={key}
          data-testid={`employee-${key}`}
          className="grid gap-1 py-3 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-baseline sm:gap-4"
        >
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </dt>
          <dd className="min-w-0 break-words text-sm">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
