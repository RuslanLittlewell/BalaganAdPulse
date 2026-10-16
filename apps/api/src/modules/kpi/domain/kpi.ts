export const KPI_METRICS = ['SPEND', 'IMPRESSIONS', 'REACH', 'CLICKS', 'CONVERSIONS', 'RESULTS', 'REVENUE', 'CTR', 'CPC', 'CPM', 'CPA', 'COST_PER_RESULT', 'ROAS', 'FREQUENCY'] as const;
export type KpiMetric = typeof KPI_METRICS[number];
export const MANUAL_KPI = 'MANUAL';

export interface MeasuredKpiInput {
  metric: KpiMetric;
  target: string;
}

export interface ManualKpiInput {
  metric: typeof MANUAL_KPI;
  name: string;
  value: string;
  target: string;
}

export type KpiInput = MeasuredKpiInput | ManualKpiInput;

export type Kpi = KpiInput & { updatedAt: Date };

export type KpiLevel =
  | { kind: 'organization' }
  | { kind: 'project'; id: string }
  | { kind: 'campaign'; id: string };

export interface KpiOwner {
  entityType: 'organization' | 'project' | 'campaign';
  entityId: string;
  clientId: string | null;
  projectId: string | null;
  campaignId: string | null;
}

export function normalizeAmount(amount: string): string {
  const [whole, fraction = ''] = amount.split('.');
  return `${BigInt(whole)}.${fraction.padEnd(4, '0')}`;
}
