import type { MessageKey } from "@/shared/config/index.js";
import type { KpiInput, KpiMetric } from "../api/api.js";

export type KpiFigure =
  | "spend" | "impressions" | "reach" | "clicks" | "conversions" | "revenue"
  | "ctr" | "cpc" | "cpm" | "cpa" | "roas" | "frequency";

export type KpiFigures = Record<KpiFigure, number | null>;

export type KpiFormat = "currency" | "count" | "percent" | "ratio" | "multiple";

export interface KpiMetricDefinition {
  id: KpiMetric;
  figure: KpiFigure;
  label: MessageKey;
  format: KpiFormat;
}

export const KPI_METRICS: readonly KpiMetricDefinition[] = [
  { id: "SPEND", figure: "spend", label: "metric.spend", format: "currency" },
  { id: "IMPRESSIONS", figure: "impressions", label: "metric.impressions", format: "count" },
  { id: "REACH", figure: "reach", label: "metric.reach", format: "count" },
  { id: "CLICKS", figure: "clicks", label: "metric.clicks", format: "count" },
  { id: "CONVERSIONS", figure: "conversions", label: "metric.conversions", format: "count" },
  { id: "REVENUE", figure: "revenue", label: "metric.revenue", format: "currency" },
  { id: "CTR", figure: "ctr", label: "metric.ctr", format: "percent" },
  { id: "CPC", figure: "cpc", label: "metric.cpc", format: "ratio" },
  { id: "CPM", figure: "cpm", label: "metric.cpm", format: "ratio" },
  { id: "CPA", figure: "cpa", label: "metric.cpa", format: "ratio" },
  { id: "ROAS", figure: "roas", label: "metric.roas", format: "multiple" },
  { id: "FREQUENCY", figure: "frequency", label: "metric.frequency", format: "multiple" },
];

const MONTHLY: ReadonlySet<KpiMetric> = new Set(["SPEND", "IMPRESSIONS", "REACH", "CLICKS", "CONVERSIONS", "REVENUE"]);
const LOWER_BETTER: ReadonlySet<KpiMetric> = new Set(["CPC", "CPM", "CPA", "FREQUENCY"]);
const DAY_MS = 24 * 60 * 60 * 1000;

export const isMonthly = (metric: KpiMetric) => MONTHLY.has(metric);
export const isLowerBetter = (metric: KpiMetric) => LOWER_BETTER.has(metric);
export const kpiMetricDefinition = (metric: KpiMetric) => KPI_METRICS.find((definition) => definition.id === metric)!;

function daysInMonth(day: Date): number {
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)).getUTCDate();
}

export function targetForRange(metric: KpiMetric, target: number, range: { from: string; to: string }): number {
  if (!isMonthly(metric)) return target;
  const end = Date.parse(`${range.to}T00:00:00Z`);
  let total = 0;
  for (let day = Date.parse(`${range.from}T00:00:00Z`); day <= end; day += DAY_MS) {
    total += target / daysInMonth(new Date(day));
  }
  return total;
}

export type KpiState = "met" | "behind" | "unmeasured";

export interface KpiProgress {
  actual: number | null;
  target: number;
  percent: number | null;
  state: KpiState;
}

export function kpiProgress(figures: KpiFigures, kpi: Pick<KpiInput, "metric" | "target">, range: { from: string; to: string }): KpiProgress {
  const target = targetForRange(kpi.metric, Number(kpi.target), range);
  const actual = figures[kpiMetricDefinition(kpi.metric).figure];
  if (actual === null) return { actual, target, percent: null, state: "unmeasured" };
  if (isLowerBetter(kpi.metric)) {
    return { actual, target, percent: actual === 0 ? null : (target / actual) * 100, state: actual <= target ? "met" : "behind" };
  }
  return { actual, target, percent: (actual / target) * 100, state: actual >= target ? "met" : "behind" };
}
