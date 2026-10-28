export type ImportedStatus = "ACTIVE" | "PAUSED" | "ENDED" | "REJECTED" | "LEARNING";
export interface ImportedEntity {
  id: string;
  name: string;
  status: ImportedStatus;
  parentId?: string;
  objective?: string;
  optimizationGoal?: string;
  conversionCategories?: string[];
}
export interface ImportedMetric {
  externalId: string;
  date: string;
  spend: string;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  results: number;
  revenue: string;
}
export interface ImportedResult {
  externalId: string;
  date: string;
  category: string;
  results: string;
}
export type CreativeKind = "IMAGE" | "VIDEO" | "TEXT";
export interface ImportedCreative {
  adExternalId: string;
  creativeId: string;
  position: number;
  kind: CreativeKind;
  title?: string;
  body?: string;
  fileUrl?: string;
  posterUrl?: string;
  sourceUrl?: string;
}
export const CREATIVE_QUALITY = 1;

export interface CreativeView {
  id: string;
  position: number;
  kind: CreativeKind;
  title: string | null;
  body: string | null;
  hasFile: boolean;
  hasPoster: boolean;
  sourceUrl: string | null;
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
  sourceUrl?: string;
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
  campaignResults?: ImportedResult[];
  adSetResults?: ImportedResult[];
  adResults?: ImportedResult[];
}
export interface PolledAd {
  adId: string;
  adName: string;
  adSet: { externalId: string; name: string };
  campaign: { externalId: string; name: string };
}
