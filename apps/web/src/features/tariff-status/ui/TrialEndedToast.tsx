import { useEffect } from "react";
import { t } from "@/shared/config/index.js";
import { onTrialEnded } from "@/shared/lib/index.js";
import { useAlerts } from "@/shared/ui/index.js";

const KEY = "trial-ended";
const HUSH_MS = 1_000;

export function TrialEndedToast() {
  const { raise } = useAlerts();
  useEffect(
    () => onTrialEnded(() => raise(t("tariff.refusal.trialEnded"), "error", { key: KEY, hushErrorsMs: HUSH_MS })),
    [raise],
  );
  return null;
}
