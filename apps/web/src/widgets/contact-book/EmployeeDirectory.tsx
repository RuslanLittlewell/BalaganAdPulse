import { useState } from "react";
import { MemberAvatar, useMembers, type Membership } from "@/entities/membership/index.js";
import { InvitationList } from "@/features/invitations/index.js";
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
  const [selectedId, setSelectedId] = useState<string>();
  const list = members.data ?? [];
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
        <div className="mt-4 border-t border-border pt-4">
          <InvitationList registrationType="EMPLOYEE" />
        </div>
      </div>
    </div>
  );
}

/** Label and value on one line, the way the client pane reads. */
function EmployeeDetails({ member }: { member: Membership }) {
  const rows = [
    ["fullName", t("contacts.fullName"), member.name],
    ["email", t("contacts.email"), member.email],
    ["role", t("team.role"), t(`role.${member.role}`)],
  ] as const;

  return (
    <dl className="grid gap-1.5 text-sm" data-testid="employee-details">
      {rows.map(([key, label, value]) => (
        <div key={key} data-testid={`employee-${key}`} className="flex min-w-0 gap-2">
          <dt className="shrink-0 text-muted-foreground">{label}:</dt>
          <dd className="min-w-0 truncate font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
