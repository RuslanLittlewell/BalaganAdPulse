import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, ConfirmDialog, EmptyState, Loader } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import {
  MemberAvatar,
  useClientMembers,
  useDeleteMember,
  type Membership,
} from "@/entities/membership/index.js";
import { InvitationDialog } from "@/features/invitations/index.js";
import { Can, useCan } from "@/features/permissions/index.js";

function Reachable({ value }: { value: string | null }) {
  return (
    <span className="min-w-0 truncate text-sm text-muted-foreground">
      {value ?? "—"}
    </span>
  );
}

function roleOf(person: Membership) {
  return person.campaign ? `${t(`role.${person.role}`)} · ${person.campaign.name}` : t(`role.${person.role}`);
}

export function CompanyTeam({ clientId }: { clientId: string }) {
  const people = useClientMembers(clientId);
  const remove = useDeleteMember();
  const removesPartners = useCan("delete", "partner");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<Membership>();
  const [failed, setFailed] = useState(false);

  if (people.isPending) {
    return (
      <div className="grid place-items-center py-8">
        <Loader />
      </div>
    );
  }

  const list = people.data ?? [];

  async function confirmRemove(person: Membership) {
    setFailed(false);
    try {
      await remove.mutateAsync(person.id);
      setRemoving(undefined);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          {t("company.team")}
        </h3>
        <Can action="create" resource="invite">
          <Button size="sm" onClick={() => setInviting(true)}>
            {t("contacts.people.add")}
          </Button>
        </Can>
      </div>

      {failed ? <p role="alert" className="text-sm text-destructive">{t("contacts.partner.remove.failed")}</p> : null}

      {list.length === 0 ? (
        <EmptyState title={t("company.team.empty")} />
      ) : (
        <ul className="min-h-0 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {list.map((person: Membership) => (
            <li
              key={person.id}
              data-testid={`company-person-${person.id}`}
              className="grid items-center gap-2 p-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_2rem]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <MemberAvatar member={person} size="sm" />
                <span className="min-w-0 truncate text-sm text-foreground">
                  {person.name}
                </span>
              </span>
              <Reachable value={person.email} />
              <Reachable value={person.phone} />
              <Reachable value={person.telegram} />
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {roleOf(person)}
              </span>
              {removesPartners && person.role === "PARTNER" ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
                  aria-label={`${t("contacts.partner.remove")} ${person.name}`}
                  onClick={() => setRemoving(person)}
                >
                  <Trash2 />
                </Button>
              ) : <span />}
            </li>
          ))}
        </ul>
      )}

      <InvitationDialog
        registrationType="CLIENT_STAFF"
        clientId={clientId}
        open={inviting}
        onClose={() => setInviting(false)}
      />

      {removing != null && (
        <ConfirmDialog
          open
          title={`${t("contacts.partner.remove")} «${removing.name}»?`}
          description={t("contacts.partner.remove.body")}
          pending={remove.isPending}
          onConfirm={() => void confirmRemove(removing)}
          onClose={() => {
            setRemoving(undefined);
            setFailed(false);
          }}
        />
      )}
    </div>
  );
}
