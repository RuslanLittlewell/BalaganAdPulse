import { t } from "@/shared/config/index.js";
import { Switch, useAlerts } from "@/shared/ui/index.js";
import { useOrganizationTwoFactor, useOrganizationTwoFactorChanges } from "../api/api.js";

export function TwoFactorRequirementSwitch() {
  const organization = useOrganizationTwoFactor(true);
  const { require } = useOrganizationTwoFactorChanges();
  const { raise } = useAlerts();
  if (!organization.data) return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
      <div className="flex flex-col gap-1">
        <span id="two-factor-required-label" className="text-sm">{t("twoFactor.require")}</span>
        <span className="text-xs text-muted-foreground">{t("twoFactor.require.hint")}</span>
      </div>
      <Switch
        aria-labelledby="two-factor-required-label"
        checked={organization.data.required}
        disabled={require.isPending}
        onCheckedChange={(required) => require.mutate(required, { onError: () => raise(t("twoFactor.failed")) })}
      />
    </div>
  );
}
