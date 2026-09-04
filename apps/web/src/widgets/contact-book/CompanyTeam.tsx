import { useState } from "react";
import { Button, EmptyState, Loader } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { MemberAvatar, useClientMembers, type Membership } from "@/entities/membership/index.js";
import { InvitationDialog } from "@/features/invitations/index.js";
import { Can } from "@/features/permissions/index.js";

/**
 * A customer's own contact book: the people on their company.
 *
 * Not the agency's client directory narrowed to one entry. The contact card,
 * the list of client invitations and the control that invites a whole new
 * company all belong to the agency, and none of them mean anything on this side
 * — offering them here is what made the screen read as two invite buttons for
 * the same thing.
 */
/** A dash rather than nothing: an absent detail is a fact, and an empty cell
 * reads as a gap in the layout. */
function Reachable({ value }: { value: string | null }) {
  return (
    <span className="min-w-0 truncate text-sm text-muted-foreground">
      {value ?? "—"}
    </span>
  );
}

export function CompanyTeam({ clientId }: { clientId: string }) {
  const people = useClientMembers(clientId);
  const [inviting, setInviting] = useState(false);

  if (people.isPending) {
    return <div className="grid place-items-center py-10"><Loader /></div>;
  }

  const list = people.data ?? [];

  return (
    <div className="flex min-h-[22rem] flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t("company.team")}</h3>
        {/* Only the principal administers the company's people; the API refuses
            anybody else, and a button that answers 403 teaches the rule by
            being pressed. */}
        <Can action="create" resource="invite">
          <Button size="sm" onClick={() => setInviting(true)}>
            {t("contacts.people.invite")}
          </Button>
        </Can>
      </div>

      {list.length === 0 ? (
        <EmptyState title={t("company.team.empty")} />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {list.map((person: Membership) => (
            <li
              key={person.id}
              data-testid={`company-person-${person.id}`}
              className="grid items-center gap-3 p-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <MemberAvatar member={person} size="sm" />
                <span className="min-w-0 truncate text-sm text-foreground">{person.name}</span>
              </span>
              <Reachable value={person.email} />
              <Reachable value={person.phone} />
              <Reachable value={person.telegram} />
              <span className="shrink-0 text-xs text-muted-foreground">
                {t(`role.${person.role}`)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* The same dialog the agency uses: it names what is being made, can be
          cancelled, and shows the link with the control that copies it. */}
      <InvitationDialog
        registrationType="CLIENT_STAFF"
        clientId={clientId}
        open={inviting}
        onClose={() => setInviting(false)}
      />
    </div>
  );
}
