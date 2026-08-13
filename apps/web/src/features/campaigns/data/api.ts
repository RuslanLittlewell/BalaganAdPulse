import { http } from "../../../lib/http.js";
import type { PropertyType } from "../../../lib/format.js";

export interface CampaignInput {
  name: string;
}

export interface CampaignSummary {
  id: string;
  clientId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignProperty {
  id: string;
  key: string | null;
  name: string;
  type: PropertyType;
  position: number;
  /** An expression tree; the server evaluates it, so the UI never reads inside. */
  formula: unknown;
}

export interface CampaignRecord {
  id: string;
  date: string;
  /** Keyed by property id; four-decimal strings, or null for an empty cell. */
  values: Record<string, string | null>;
}

export interface CampaignTable {
  id: string;
  clientId: string;
  name: string;
  position: number;
  properties: CampaignProperty[];
  records: CampaignRecord[];
  totals: Record<string, string | null>;
}

export const campaignsApi = {
  list: (clientId: string) => http.get<CampaignSummary[]>(`/clients/${clientId}/campaigns`),
  get: (campaignId: string) => http.get<CampaignTable>(`/campaigns/${campaignId}`),
  create: (clientId: string, body: CampaignInput) =>
    http.post<CampaignSummary>(`/clients/${clientId}/campaigns`, body),
  update: (campaignId: string, body: CampaignInput) =>
    http.patch<CampaignSummary>(`/campaigns/${campaignId}`, body),
  remove: (campaignId: string) => http.del(`/campaigns/${campaignId}`),
};

export interface RecordInput {
  date: string;
}

export interface CampaignRecordSummary {
  id: string;
  campaignId: string;
  date: string;
}

export const recordsApi = {
  create: (campaignId: string, body: RecordInput) =>
    http.post<CampaignRecordSummary>(`/campaigns/${campaignId}/records`, body),
};

/** What the value endpoint answers with: the recomputed row and the recomputed totals. */
export interface ValueWriteResult {
  record: CampaignRecord;
  totals: Record<string, string | null>;
}

export const valuesApi = {
  set: (recordId: string, propertyId: string, value: string | null) =>
    http.put<ValueWriteResult>(`/records/${recordId}/values/${propertyId}`, { value }),
};
