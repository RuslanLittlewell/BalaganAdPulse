import {
  formatCount, formatCurrency, formatMultiple, formatPercent, formatRatio,
} from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import type { Channel, DeliveryStatus, Performance } from "../api/api.js";

export function channelLabel(channel: Channel): string {
  return t(`channel.${channel}`);
}

export function statusLabel(status: DeliveryStatus): string {
  return t(`status.${status}`);
}

export function statusTone(status: DeliveryStatus): "positive" | "warning" | "danger" | "muted" {
  if (status === "ACTIVE") return "positive";
  if (status === "LEARNING") return "warning";
  if (status === "REJECTED") return "danger";
  return "muted";
}

export type PerformanceTone = "danger" | "stable" | "profitable";

export function performanceTone(performance: Performance): PerformanceTone {
  if (performance.roas != null && performance.roas < 0.9) return "danger";
  if (performance.roas != null && performance.roas > 1.2) return "profitable";
  return "stable";
}

export interface MetricColumn {
  id: keyof Performance;
  label: string;
  format: (performance: Performance) => string;
}

export const METRIC_COLUMNS: MetricColumn[] = [
  { id: "spend", label: t("metric.spend"), format: (p) => formatCurrency(p.spend) },
  { id: "impressions", label: t("metric.impressions"), format: (p) => formatCount(p.impressions) },
  { id: "reach", label: t("metric.reach"), format: (p) => formatCount(p.reach) },
  { id: "clicks", label: t("metric.clicks"), format: (p) => formatCount(p.clicks) },
  { id: "conversions", label: t("metric.conversions"), format: (p) => formatCount(p.conversions) },
  { id: "revenue", label: t("metric.revenue"), format: (p) => formatCurrency(p.revenue) },
  { id: "ctr", label: t("metric.ctr"), format: (p) => formatPercent(p.ctr) },
  { id: "cpc", label: t("metric.cpc"), format: (p) => formatRatio(p.cpc) },
  { id: "cpm", label: t("metric.cpm"), format: (p) => formatRatio(p.cpm) },
  { id: "cpa", label: t("metric.cpa"), format: (p) => formatRatio(p.cpa) },
  { id: "roas", label: t("metric.roas"), format: (p) => formatMultiple(p.roas) },
  { id: "frequency", label: t("metric.frequency"), format: (p) => formatMultiple(p.frequency) },
];

export const EMPTY_PERFORMANCE: Performance = {
  spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, revenue: 0,
  ctr: null, cpc: null, cpm: null, cpa: null, roas: null, frequency: null,
};
