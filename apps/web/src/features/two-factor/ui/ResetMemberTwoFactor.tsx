import { useState } from "react";
import { t } from "@/shared/config/index.js";
import { Button, ConfirmDialog, useAlerts } from "@/shared/ui/index.js";
import { useOrganizationTwoFactor, useOrganizationTwoFactorChanges } from "../api/api.js";

export function ResetMemberTwoFactor({ membershipId, name }: { membershipId: string; name: string }) {
  const organization = useOrganizationTwoFactor(true);
  const { resetMember } = useOrganizationTwoFactorChanges();
  const { raise } = useAlerts();
  const [asking, setAsking] = useState(false);
  if (!organization.data?.enrolledMembershipIds.includes(membershipId)) return null;
  return (
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
      <span className="text-xs text-muted-foreground">{t("twoFactor.memberOn")}</span>
      <Button type="button" variant="outline" size="sm" onClick={() => setAsking(true)}>{t("twoFactor.reset")}</Button>
      {asking ? (
        <ConfirmDialog
          open
          title={`${t("twoFactor.reset")}: ${name}?`}
          description={t("twoFactor.reset.body")}
          confirmLabel={t("twoFactor.reset.confirm")}
          pending={resetMember.isPending}
          onConfirm={() => resetMember.mutate(membershipId, {
            onSuccess: () => raise(t("twoFactor.reset.done"), "success"),
            onError: () => raise(t("twoFactor.failed")),
            onSettled: () => setAsking(false),
          })}
          onClose={() => setAsking(false)}
        />
      ) : null}
    </div>
  );
}
