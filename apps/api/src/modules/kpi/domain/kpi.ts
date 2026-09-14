export const KPI_METRICS = ['SPEND', 'IMPRESSIONS', 'REACH', 'CLICKS', 'CONVERSIONS', 'REVENUE', 'CTR', 'CPC', 'CPM', 'CPA', 'ROAS', 'FREQUENCY'] as const;
export type KpiMetric = typeof KPI_METRICS[number];

export interface KpiInput {
  metric: KpiMetric;
  target: string;
}

export interface Kpi extends KpiInput {
  updatedAt: Date;
}

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

export function normalizeTarget(target: string): string {
  const [whole, fraction = ''] = target.split('.');
  return `${BigInt(whole)}.${fraction.padEnd(4, '0')}`;
}
