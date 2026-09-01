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

/** How a delivery status is coloured. Only `REJECTED` is an alarm; a paused
 * campaign is a decision someone made, not a fault. */
export function statusTone(status: DeliveryStatus): "positive" | "warning" | "danger" | "muted" {
  if (status === "ACTIVE") return "positive";
  if (status === "LEARNING") return "warning";
  if (status === "REJECTED") return "danger";
  return "muted";
}

export type PerformanceTone = "danger" | "stable" | "profitable";

/** Result over the selected period. A missing ROAS has no evidence of loss or
 * profit, so it stays neutral/stable rather than raising a false alarm. */
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

/**
 * The twelve figures, in the order they are read: what was measured, then what
 * it works out to. Defined once because a campaign row, an ad-set row and an ad
 * row are the same twelve columns — a table that drifted from its neighbour
 * would be read as a difference in the data.
 */
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

/** Zero of everything: what a screen shows while the figures are still loading,
 * so the layout does not jump when they arrive. */
export const EMPTY_PERFORMANCE: Performance = {
  spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, revenue: 0,
  ctr: null, cpc: null, cpm: null, cpa: null, roas: null, frequency: null,
};
