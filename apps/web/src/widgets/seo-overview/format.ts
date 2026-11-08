import { ru, t, type MessageKey } from "@/shared/config/index.js";
import type { SeoRating } from "@/entities/seo/index.js";

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

const LAB_THRESHOLDS = {
  lcpMs: [2500, 4000],
  cls: [0.1, 0.25],
  tbtMs: [200, 600],
  fcpMs: [1800, 3000],
  speedIndexMs: [3400, 5800],
} as const;

export function rateLab(metric: keyof typeof LAB_THRESHOLDS, value: number): SeoRating {
  const [good, poor] = LAB_THRESHOLDS[metric];
  if (value <= good) return "GOOD";
  return value <= poor ? "NEEDS_IMPROVEMENT" : "POOR";
}

export const RATING_TEXT: Record<SeoRating, string> = {
  GOOD: "text-emerald-600 dark:text-emerald-400",
  NEEDS_IMPROVEMENT: "text-amber-600 dark:text-amber-400",
  POOR: "text-red-600 dark:text-red-400",
};

export function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
}

export function channelName(channel: string): string {
  const key = `seo.channel.${channel}`;
  return key in ru ? t(key as MessageKey) : channel;
}

export function change(current: number, previous: number): { text: string; trend: "up" | "down" | "same" } | null {
  if (previous === 0) return current > 0 ? { text: t("seo.traffic.new"), trend: "same" } : null;
  const ratio = (current - previous) / previous;
  const text = `${ratio > 0 ? "+" : ratio < 0 ? "−" : ""}${decimal(Math.abs(ratio) * 100, 1)}%`;
  return { text, trend: ratio > 0 ? "up" : ratio < 0 ? "down" : "same" };
}
