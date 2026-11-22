import { t } from "@/shared/config/index.js";
import { ApiError } from "@/shared/lib/index.js";

export function twoFactorError(error: unknown): string {
  if (error instanceof ApiError && error.status === 503) return t("twoFactor.unavailable");
  if (error instanceof ApiError && error.status === 400) return t("twoFactor.invalid");
  return t("twoFactor.failed");
}
