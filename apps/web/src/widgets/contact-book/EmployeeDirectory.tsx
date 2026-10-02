import { useState } from "react";
import {
  MemberAvatar,
  useDeleteMember,
  useMembers,
  type Membership,
} from "@/entities/membership/index.js";
import { EmployeeAccess } from "./EmployeeAccess.js";
import { useAuth } from "@/features/auth/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ListItem,
  Loader,
  useAlerts,
} from "@/shared/ui/index.js";
import { Can } from "@/features/permissions/index.js";

export function EmployeeDirectory() {
  const members = useMembers();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string>();
  const list = (members.data ?? []).filter((member) => member.userId !== user?.id);
  const selected = list.find((member) => member.id === selectedId) ?? list[0];
  const [removing, setRemoving] = useState<Membership>();
  const remove = useDeleteMember();
  const { raise } = useAlerts();

  function confirmRemove(member: Membership) {
    remove.mutate(member.id, {
      onSuccess: () => setSelectedId(undefined),
      onError: () => raise(t("contacts.employees.remove.failed")),
      onSettled: () => setRemoving(undefined),
    });
  }

  if (members.isPending) {
    return <div className="grid place-items-center py-10"><Loader /></div>;
  }

  return (
    <div className="grid min-h-[22rem] gap-4 sm:grid-cols-[minmax(14rem,22%)_minmax(0,1fr)] flex-1">
      <div className="flex max-h-[60vh] flex-col gap-1 overflow-auto">
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
        {selected && (
          <Can action="delete" resource="member">
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
                onClick={() => setRemoving(selected)}
              >
                {t("contacts.employees.remove")}
              </Button>
            </div>
          </Can>
        )}
        {selected && <EmployeeDetails member={selected} />}
        {selected && <EmployeeAccess membershipId={selected.id} />}
      </div>

      {removing != null && (
        <ConfirmDialog
          open
          title={`${t("contacts.employees.remove")} «${removing.name}»?`}
          description={t("contacts.employees.remove.body")}
          pending={remove.isPending}
          onConfirm={() => confirmRemove(removing)}
          onClose={() => setRemoving(undefined)}
        />
      )}
    </div>
  );
}

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
