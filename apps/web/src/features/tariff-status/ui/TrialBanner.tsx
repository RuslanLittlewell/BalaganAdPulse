import { useAuth } from "@/features/auth/index.js";
import { trialDaysLeft } from "@/entities/tariff/index.js";
import { t } from "@/shared/config/index.js";
import { useNow } from "@/shared/lib/index.js";

export function TrialBanner() {
  const { tariff } = useAuth();
  const now = useNow();
  if (!tariff || tariff.tariff !== "TRIAL" || !tariff.trialEndsAt) return null;
  if (tariff.trialExpired) {
    return (
      <p role="alert" data-trial="ended" className="mr-auto min-w-0 text-sm text-destructive">
        {t("tariff.trial.ended")}
      </p>
    );
  }
  return (
    <p role="status" data-trial="running" className="mr-auto min-w-0 text-sm text-muted-foreground">
      {t("tariff.trial.daysLeft")} <span className="font-medium tabular-nums text-foreground">{trialDaysLeft(tariff.trialEndsAt, now)}</span>
    </p>
  );
}
