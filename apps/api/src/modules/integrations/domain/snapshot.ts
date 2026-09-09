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
export type CreativeKind = "IMAGE" | "VIDEO";
export interface ImportedCreative {
  adExternalId: string;
  creativeId: string;
  position: number;
  kind: CreativeKind;
  title?: string;
  body?: string;
  fileUrl?: string;
  posterUrl?: string;
}
export interface CreativeView {
  id: string;
  position: number;
  kind: CreativeKind;
  title: string | null;
  body: string | null;
  hasFile: boolean;
  hasPoster: boolean;
}
export interface StoredCreative {
  adExternalId: string;
  creativeId: string;
  position: number;
  kind: CreativeKind;
  title?: string;
  body?: string;
  fileKey?: string;
  contentType?: string;
  bytes?: number;
  posterKey?: string;
  posterContentType?: string;
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
