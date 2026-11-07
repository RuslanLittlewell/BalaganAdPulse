import { t } from "@/shared/config/index.js";
import type { SeoMetric, SeoRating } from "@/entities/seo/index.js";

const NBSP = " ";

export function decimal(value: number, digits: number): string {
  return value.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits }).replace(/\s/g, NBSP);
}

export function percent(fraction: number | null): string {
  return fraction === null ? "—" : `${decimal(fraction * 100, 2)}%`;
}

export function position(value: number | null): string {
  return value === null ? "—" : decimal(value, 1);
}

export function milliseconds(value: number): string {
  return value >= 1000 ? `${decimal(value / 1000, 1)}${NBSP}${t("seo.unit.seconds")}` : `${Math.round(value)}${NBSP}${t("seo.unit.ms")}`;
}

export function metricValue(metric: SeoMetric, p75: number): string {
  if (metric === "CLS") return decimal(p75, 2);
  if (metric === "INP") return `${Math.round(p75)}${NBSP}${t("seo.unit.ms")}`;
  return milliseconds(p75);
}

export const RATING_TEXT: Record<SeoRating, string> = {
  GOOD: "text-emerald-600 dark:text-emerald-400",
  NEEDS_IMPROVEMENT: "text-amber-600 dark:text-amber-400",
  POOR: "text-red-600 dark:text-red-400",
};

export const RATING_FILL: Record<SeoRating, string> = {
  GOOD: "bg-emerald-500",
  NEEDS_IMPROVEMENT: "bg-amber-500",
  POOR: "bg-red-500",
};

export function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
}
