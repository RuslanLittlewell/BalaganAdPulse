import type { ResultType } from '#modules/campaigns/index.js';

export const KPI_METRICS = ['SPEND', 'IMPRESSIONS', 'REACH', 'CLICKS', 'CONVERSIONS', 'RESULTS', 'REVENUE', 'CTR', 'CPC', 'CPM', 'CPA', 'COST_PER_RESULT', 'ROAS', 'FREQUENCY'] as const;
export type KpiMetric = typeof KPI_METRICS[number];

export const isKpiMetric = (metric: string): metric is KpiMetric =>
  (KPI_METRICS as readonly string[]).includes(metric);

export const MANUAL_KPI = 'MANUAL';

export const TYPED_KPI_METRICS: readonly KpiMetric[] = ['RESULTS', 'COST_PER_RESULT'];

export const isTypedKpiMetric = (metric: string) => (TYPED_KPI_METRICS as readonly string[]).includes(metric);

export interface MeasuredKpiInput {
  metric: KpiMetric;
  target: string;
  resultType?: ResultType;
}

export interface ManualKpiInput {
  metric: typeof MANUAL_KPI;
  name: string;
  value: string;
  target: string;
}

export type KpiInput = MeasuredKpiInput | ManualKpiInput;

export type Kpi = KpiInput & { updatedAt: Date };

export const MAX_PROJECT_KPIS = 5;

export type ProjectKpiInput = KpiInput & { enabled: boolean };

export type NewProjectKpi = Kpi & { enabled: boolean };

export type ProjectKpi = NewProjectKpi & { id: string };

export type KpiLevel =
  | { kind: 'organization' }
  | { kind: 'campaign'; id: string };

export interface KpiOwner {
  entityType: 'organization' | 'campaign';
  entityId: string;
  clientId: string | null;
  projectId: string | null;
  campaignId: string | null;
}

export function normalizeAmount(amount: string): string {
  const [whole, fraction = ''] = amount.split('.');
  return `${BigInt(whole)}.${fraction.padEnd(4, '0')}`;
}
