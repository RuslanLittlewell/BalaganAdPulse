export type ImportedStatus = "ACTIVE" | "PAUSED" | "ENDED" | "REJECTED" | "LEARNING";
export interface ImportedEntity {
  id: string;
  name: string;
  status: ImportedStatus;
  parentId?: string;
  objective?: string;
}
export interface ImportedMetric {
  externalId: string;
  date: string;
  spend: string;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  revenue: string;
}
export interface Snapshot {
  from: string;
  to: string;
  campaigns: ImportedEntity[];
  adSets: ImportedEntity[];
  ads: ImportedEntity[];
  campaignMetrics: ImportedMetric[];
  adSetMetrics: ImportedMetric[];
  adMetrics: ImportedMetric[];
}
