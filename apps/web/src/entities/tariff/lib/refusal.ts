import { isLimitedResource } from "@adpulse/access-policy";
import { t } from "@/shared/config/index.js";
import { ApiError } from "@/shared/lib/index.js";
import { resourceLabel } from "../model/tariff.js";

interface RefusalDetail {
  readonly code?: unknown;
  readonly resource?: unknown;
  readonly limit?: unknown;
}

export function tariffRefusal(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 403) return null;
  const detail = error.details[0] as RefusalDetail | undefined;
  if (detail?.code === "TRIAL_ENDED") return t("tariff.refusal.trialEnded");
  if (detail?.code !== "TARIFF_LIMIT" || typeof detail.resource !== "string" || !isLimitedResource(detail.resource)) {
    return null;
  }
  return `${t("tariff.refusal.limit")} «${resourceLabel(detail.resource)}»: ${String(detail.limit)}. ${t("tariff.refusal.upgrade")}`;
}
