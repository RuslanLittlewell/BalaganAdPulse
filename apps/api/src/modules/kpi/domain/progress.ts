import type { ResultTypeFigure } from '#modules/campaigns/index.js';
import { MANUAL_KPI, type KpiInput, type KpiMetric, type MeasuredKpiInput } from './kpi.js';

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

export function kpiPercent(kpi: KpiInput, figures: KpiFigures, range: IsoDateRange): number | null {
  if (kpi.metric === MANUAL_KPI) return (Number(kpi.value) / monthlyTarget(Number(kpi.target), range)) * 100;
  const target = targetForRange(kpi.metric, Number(kpi.target), range);
  const actual = actualOf(kpi, figures);
  if (actual === null) return null;
  if (LOWER_BETTER.has(kpi.metric)) return actual === 0 ? null : (target / actual) * 100;
  return (actual / target) * 100;
}

export function isKpiGreen(kpi: KpiInput, figures: KpiFigures, range: IsoDateRange): boolean {
  const percent = kpiPercent(kpi, figures, range);
  return percent !== null && Math.round(percent) >= GREEN_FROM;
}

export function monthToDate(now: Date): IsoDateRange {
  const to = now.toISOString().slice(0, 10);
  return { from: `${to.slice(0, 7)}-01`, to };
}
