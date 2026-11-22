import { t } from "@/shared/config/index.js";
import { getIntlLocale } from "@/shared/config/locale.js";
import { ApiError } from "@/shared/lib/index.js";

export function codeOf(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const detail = error.details[0] as { code?: unknown } | undefined;
  return typeof detail?.code === "string" ? detail.code : null;
}

export function lockMessage(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 403) return null;
  const detail = error.details[0] as { code?: unknown; until?: unknown } | undefined;
  if (detail?.code === "PASSWORD_RESET_REQUIRED") return t("auth.locked.reset");
  if (detail?.code !== "SIGN_IN_LOCKED" || typeof detail.until !== "string") return null;
  const time = new Intl.DateTimeFormat(getIntlLocale(), { hour: "2-digit", minute: "2-digit" }).format(new Date(detail.until));
  return `${t("auth.locked.until")} ${time}.`;
}
