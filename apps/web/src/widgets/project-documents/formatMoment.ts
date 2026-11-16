import { getIntlLocale } from "@/shared/config/locale.js";
export function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString(getIntlLocale(), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
