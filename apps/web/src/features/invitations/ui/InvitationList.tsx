import { XIcon } from "lucide-react";
import {
  useInvitations,
  useRevokeInvitation,
  type RegistrationType,
} from "@/entities/invitation/index.js";
import { Can } from "@/features/permissions/index.js";
import { t } from "@/shared/config/index.js";
import { Button, CopyButton, Loader } from "@/shared/ui/index.js";
import { registrationLink } from "../lib/link.js";

export interface InvitationListProps {
  registrationType: RegistrationType;
}

/** The invitations of one registration type that somebody can still act on. */
export function InvitationList({ registrationType }: InvitationListProps) {
  const invitations = useInvitations(registrationType);
  const revoke = useRevokeInvitation();

  return (
    <section className="flex flex-col gap-2" aria-label={t("invites.title")}>
      <h4 className="text-sm font-medium">{t("invites.title")}</h4>

      {invitations.isPending && <Loader label={t("state.loading")} />}
      {invitations.isError && (
        <p className="text-sm text-destructive">{t("invites.loadFailed")}</p>
      )}
      {invitations.isSuccess && (
        invitations.data.length === 0
          ? <p className="text-sm text-muted-foreground">{t("invites.empty")}</p>
          : (
            <ul className="grid gap-2">
              {invitations.data.map((invitation) => {
                const link = registrationLink(invitation.registrationUrl);
                return (
                  <li
                    key={invitation.id}
                    className="flex items-center gap-2 rounded-md border border-border p-2"
                  >
                    {/* The whole address, not the bare code: it is what gets
                        pasted into a message. */}
                    <code className="min-w-0 flex-1 break-all text-xs">{link}</code>
                    {invitation.role && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t(`role.${invitation.role}`)}
                      </span>
                    )}
                    <CopyButton value={link} label={t("invites.copyLink")} />
                    <Can action="delete" resource="invite">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={revoke.isPending}
                        aria-label={`${t("invites.revoke")} ${invitation.code}`}
                        onClick={() => void revoke.mutateAsync(invitation.id)}
                      >
                        <XIcon aria-hidden="true" />
                      </Button>
                    </Can>
                  </li>
                );
              })}
            </ul>
          )
      )}
    </section>
  );
}
