import { formatPercent, formatRatio, type Currency } from "@/shared/lib/index.js";

export function monthTitle(month: string): string {
  const title = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("ru-RU", {
    month: "long", year: "numeric", timeZone: "UTC",
  }).replace(/\s*г\.$/, "");
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function monthShort(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("ru-RU", { month: "short", timeZone: "UTC" })
    .replace(".", "");
}

export function formatMoney(amount: string | null, currency: Currency): string {
  return formatRatio(amount === null ? null : Number(amount), currency);
}

export function formatChange(fraction: string | null): string | null {
  if (fraction === null) return null;
  const percent = Number(fraction) * 100;
  return `${percent > 0 ? "+" : ""}${formatPercent(percent).replace(",00%", "%")}`;
}
