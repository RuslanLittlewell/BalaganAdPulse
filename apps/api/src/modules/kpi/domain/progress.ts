import { MANUAL_KPI, type KpiInput, type KpiMetric } from './kpi.js';

export type KpiFigure =
  | 'spend' | 'impressions' | 'reach' | 'clicks' | 'conversions' | 'results' | 'revenue'
  | 'ctr' | 'cpc' | 'cpm' | 'cpa' | 'costPerResult' | 'roas' | 'frequency';

export type KpiFigures = Readonly<Record<KpiFigure, number | null>>;

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

export function targetForRange(metric: KpiMetric, target: number, range: IsoDateRange): number {
  if (!MONTHLY.has(metric)) return target;
  const end = Date.parse(`${range.to}T00:00:00Z`);
  let total = 0;
  for (let day = Date.parse(`${range.from}T00:00:00Z`); day <= end; day += DAY_MS) {
    total += target / daysInMonth(new Date(day));
  }
  return total;
}

export function kpiPercent(kpi: KpiInput, figures: KpiFigures, range: IsoDateRange): number | null {
  if (kpi.metric === MANUAL_KPI) return (Number(kpi.value) / Number(kpi.target)) * 100;
  const target = targetForRange(kpi.metric, Number(kpi.target), range);
  const actual = figures[FIGURE[kpi.metric]];
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
