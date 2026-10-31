import { RESULT_TYPES, type KpiAccount, type ResultType, type ResultTypeFigure } from '#modules/campaigns/index.js';
import {
  accountKey, isKpiMetric, isTypedKpiMetric, MANUAL_KPI, type KpiInput, type KpiMetric, type MeasuredKpiInput,
} from './kpi.js';

export type KpiFigure =
  | 'spend' | 'impressions' | 'reach' | 'clicks' | 'conversions' | 'results' | 'revenue'
  | 'ctr' | 'cpc' | 'cpm' | 'cpa' | 'costPerResult' | 'roas' | 'frequency';

export type KpiFigures = Readonly<Record<KpiFigure, number | null>> & {
  readonly resultTypes?: readonly ResultTypeFigure[];
};

export interface IsoDateRange {
  readonly from: string;
  readonly to: string;
}

const FIGURE: Readonly<Record<KpiMetric, KpiFigure>> = {
  SPEND: 'spend', IMPRESSIONS: 'impressions', REACH: 'reach', CLICKS: 'clicks',
  CONVERSIONS: 'conversions', RESULTS: 'results', REVENUE: 'revenue',
  CTR: 'ctr', CPC: 'cpc', CPM: 'cpm', CPA: 'cpa', COST_PER_RESULT: 'costPerResult',
  ROAS: 'roas', FREQUENCY: 'frequency',
};

const MONTHLY: ReadonlySet<KpiMetric> = new Set(['SPEND', 'IMPRESSIONS', 'REACH', 'CLICKS', 'CONVERSIONS', 'RESULTS', 'REVENUE']);
const LOWER_BETTER: ReadonlySet<KpiMetric> = new Set(['CPC', 'CPM', 'CPA', 'COST_PER_RESULT', 'FREQUENCY']);
const DAY_MS = 24 * 60 * 60 * 1000;
const GREEN_FROM = 100;
const MET_FROM = 90;
const BEHIND_FROM = 70;

function daysInMonth(day: Date): number {
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)).getUTCDate();
}

export function monthlyTarget(target: number, range: IsoDateRange): number {
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

export function targetForRange(metric: KpiMetric, target: number, range: IsoDateRange): number {
  return MONTHLY.has(metric) ? monthlyTarget(target, range) : target;
}

function actualOf(kpi: MeasuredKpiInput, figures: KpiFigures): number | null {
  if (!kpi.resultType) return figures[FIGURE[kpi.metric]];
  const typed = figures.resultTypes?.find((figure) => figure.type === kpi.resultType);
  if (kpi.metric === 'RESULTS') return typed?.results ?? 0;
  return typed && typed.results > 0 ? typed.spend / typed.results : null;
}

export interface KpiReading {
  readonly actual: number | null;
  readonly target: number;
  readonly percent: number | null;
}

export function kpiReading(kpi: KpiInput, figures: KpiFigures, range: IsoDateRange): KpiReading {
  if (kpi.metric === MANUAL_KPI) {
    const target = monthlyTarget(Number(kpi.target), range);
    const actual = Number(kpi.value);
    return { actual, target, percent: (actual / target) * 100 };
  }
  const target = targetForRange(kpi.metric, Number(kpi.target), range);
  const actual = actualOf(kpi, figures);
  if (actual === null) return { actual, target, percent: null };
  if (LOWER_BETTER.has(kpi.metric)) return { actual, target, percent: actual === 0 ? null : (target / actual) * 100 };
  return { actual, target, percent: (actual / target) * 100 };
}

export function kpiPercent(kpi: KpiInput, figures: KpiFigures, range: IsoDateRange): number | null {
  return kpiReading(kpi, figures, range).percent;
}

export const isLowerBetter = (metric: KpiMetric) => LOWER_BETTER.has(metric);

export function isKpiGreen(kpi: KpiInput, figures: KpiFigures, range: IsoDateRange): boolean {
  const percent = kpiPercent(kpi, figures, range);
  return percent !== null && Math.round(percent) >= GREEN_FROM;
}

export function monthToDate(now: Date): IsoDateRange {
  const to = now.toISOString().slice(0, 10);
  return { from: `${to.slice(0, 7)}-01`, to };
}

export interface CarriedKpi {
  readonly metric: string;
  readonly target: string;
  readonly name?: string | null;
  readonly value?: string | null;
  readonly resultType?: string | null;
  readonly enabled: boolean;
  readonly account: KpiAccount | null;
}

const isResultType = (type: string): type is ResultType => (RESULT_TYPES as readonly string[]).includes(type);

export function enabledKpiInput(carried: CarriedKpi): KpiInput | null {
  if (!carried.enabled) return null;
  if (carried.metric === MANUAL_KPI) {
    return carried.name != null && carried.value != null
      ? { metric: MANUAL_KPI, name: carried.name, value: carried.value, target: carried.target }
      : null;
  }
  if (!isKpiMetric(carried.metric)) return null;
  return carried.resultType && isResultType(carried.resultType) && isTypedKpiMetric(carried.metric)
    ? { metric: carried.metric, target: carried.target, resultType: carried.resultType }
    : { metric: carried.metric, target: carried.target };
}

const average = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

export function projectKpiPercent(
  kpis: readonly CarriedKpi[],
  figuresOf: (account: KpiAccount | null) => KpiFigures,
  range: IsoDateRange,
): number | null {
  const shares = new Map<string, number[]>();
  for (const carried of kpis) {
    const kpi = enabledKpiInput(carried);
    if (!kpi) continue;
    const percent = kpiPercent(kpi, figuresOf(carried.account), range);
    if (percent === null || !Number.isFinite(percent)) continue;
    const key = carried.account ? accountKey(carried.account) : '';
    shares.set(key, [...(shares.get(key) ?? []), Math.min(percent, 100)]);
  }
  return shares.size === 0 ? null : Math.round(average([...shares.values()].map(average)));
}

export type KpiStanding = 'met' | 'behind' | 'danger' | 'none';

export function kpiStanding(percent: number | null): KpiStanding {
  if (percent === null) return 'none';
  if (percent >= MET_FROM) return 'met';
  if (percent >= BEHIND_FROM) return 'behind';
  return 'danger';
}
