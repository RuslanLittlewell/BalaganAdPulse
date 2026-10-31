import type { MessageKey } from "@/shared/config/index.js";
import {
  accountKey, kpiInputOf, MANUAL_KPI, type CarriedKpi, type KpiAccount, type KpiInput, type KpiMetric, type MeasuredKpiInput,
} from "../api/api.js";

export type KpiFigure =
  | "spend" | "impressions" | "reach" | "clicks" | "conversions" | "results" | "revenue"
  | "ctr" | "cpc" | "cpm" | "cpa" | "costPerResult" | "roas" | "frequency";

export interface KpiTypedFigure {
  type: string;
  results: number;
  spend: number;
}

export type KpiFigures = Record<KpiFigure, number | null> & { resultTypes?: readonly KpiTypedFigure[] };

export type KpiFormat = "currency" | "count" | "percent" | "ratio" | "multiple" | "number";

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
  { id: "RESULTS", figure: "results", label: "metric.results", format: "count" },
  { id: "REVENUE", figure: "revenue", label: "metric.revenue", format: "currency" },
  { id: "CTR", figure: "ctr", label: "metric.ctr", format: "percent" },
  { id: "CPC", figure: "cpc", label: "metric.cpc", format: "ratio" },
  { id: "CPM", figure: "cpm", label: "metric.cpm", format: "ratio" },
  { id: "CPA", figure: "cpa", label: "metric.cpa", format: "ratio" },
  { id: "COST_PER_RESULT", figure: "costPerResult", label: "metric.costPerResult", format: "ratio" },
  { id: "ROAS", figure: "roas", label: "metric.roas", format: "multiple" },
  { id: "FREQUENCY", figure: "frequency", label: "metric.frequency", format: "multiple" },
];

const MONTHLY: ReadonlySet<KpiMetric> = new Set(["SPEND", "IMPRESSIONS", "REACH", "CLICKS", "CONVERSIONS", "RESULTS", "REVENUE"]);
const LOWER_BETTER: ReadonlySet<KpiMetric> = new Set(["CPC", "CPM", "CPA", "COST_PER_RESULT", "FREQUENCY"]);
const DAY_MS = 24 * 60 * 60 * 1000;

export const isMonthly = (metric: KpiMetric) => MONTHLY.has(metric);
export const isLowerBetter = (metric: KpiMetric) => LOWER_BETTER.has(metric);
export const kpiMetricDefinition = (metric: KpiMetric) => KPI_METRICS.find((definition) => definition.id === metric)!;

function daysInMonth(day: Date): number {
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)).getUTCDate();
}

export function monthlyTarget(target: number, range: { from: string; to: string }): number {
  const end = Date.parse(`${range.to}T00:00:00Z`);
  const daysByMonth = new Map<number, { days: number; length: number }>();
  for (let day = Date.parse(`${range.from}T00:00:00Z`); day <= end; day += DAY_MS) {
    const date = new Date(day);
    const month = date.getUTCFullYear() * 12 + date.getUTCMonth();
    const counted = daysByMonth.get(month) ?? { days: 0, length: daysInMonth(date) };
    daysByMonth.set(month, { ...counted, days: counted.days + 1 });
  }
  let total = 0;
  for (const { days, length } of daysByMonth.values()) total += (target * days) / length;
  return total;
}

export function targetForRange(metric: KpiMetric, target: number, range: { from: string; to: string }): number {
  return isMonthly(metric) ? monthlyTarget(target, range) : target;
}

export type KpiState = "exceeded" | "met" | "behind" | "unmeasured";

export interface KpiProgress {
  actual: number | null;
  target: number;
  percent: number | null;
  state: KpiState;
}

function manualProgress(actual: number, target: number): KpiProgress {
  const state: KpiState = actual > target ? "exceeded" : actual === target ? "met" : "behind";
  return { actual, target, percent: (actual / target) * 100, state };
}

function actualOf(kpi: MeasuredKpiInput, figures: KpiFigures): number | null {
  if (!kpi.resultType) return figures[kpiMetricDefinition(kpi.metric).figure];
  const typed = figures.resultTypes?.find((figure) => figure.type === kpi.resultType);
  if (kpi.metric === "RESULTS") return typed?.results ?? 0;
  return typed && typed.results > 0 ? typed.spend / typed.results : null;
}

export function kpiProgress(figures: KpiFigures, kpi: KpiInput, range: { from: string; to: string }): KpiProgress {
  if (kpi.metric === MANUAL_KPI) return manualProgress(Number(kpi.value), monthlyTarget(Number(kpi.target), range));
  const target = targetForRange(kpi.metric, Number(kpi.target), range);
  const actual = actualOf(kpi, figures);
  if (actual === null) return { actual, target, percent: null, state: "unmeasured" };
  const better = isLowerBetter(kpi.metric) ? target - actual : actual - target;
  const state: KpiState = better > 0 ? "exceeded" : better === 0 ? "met" : "behind";
  const percent = isLowerBetter(kpi.metric)
    ? (actual === 0 ? null : (target / actual) * 100)
    : (actual / target) * 100;
  return { actual, target, percent, state };
}

export function enabledKpi(carried: CarriedKpi, withManual = true): KpiInput | null {
  const kpi = carried.enabled === false ? null : kpiInputOf(carried);
  return kpi && (withManual || kpi.metric !== MANUAL_KPI) ? kpi : null;
}

export function enabledKpis(kpis: readonly CarriedKpi[] | null | undefined, withManual = true): KpiInput[] {
  return (kpis ?? []).flatMap((carried) => enabledKpi(carried, withManual) ?? []);
}

const average = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

export function kpiResult(
  kpis: readonly CarriedKpi[] | null | undefined,
  figuresOf: (account: KpiAccount | null) => KpiFigures,
  range: { from: string; to: string },
  withManual = true,
): number | null {
  const shares = new Map<string, number[]>();
  for (const carried of kpis ?? []) {
    const kpi = enabledKpi(carried, withManual);
    if (!kpi) continue;
    const account = carried.account ?? null;
    const percent = kpiProgress(figuresOf(account), kpi, range).percent;
    if (percent === null || !Number.isFinite(percent)) continue;
    const key = account ? accountKey(account) : "";
    shares.set(key, [...(shares.get(key) ?? []), Math.min(percent, 100)]);
  }
  return shares.size === 0 ? null : average([...shares.values()].map(average));
}
