import { http } from "@/shared/lib/index.js";

export const CHANNELS = ["META", "GOOGLE", "YANDEX", "VK", "TIKTOK", "LINKEDIN", "TELEGRAM"] as const;
export type Channel = (typeof CHANNELS)[number];

export const DELIVERY_STATUSES = ["ACTIVE", "LEARNING", "PAUSED", "REJECTED", "ENDED"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export interface DateRange {
  from: string;
  to: string;
}

export interface Measured {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

export interface Derived {
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cpa: number | null;
  roas: number | null;
  frequency: number | null;
}

export interface Performance extends Measured, Derived {}

export interface MeasuredDay extends Measured {
  date: string;
}

export interface Campaign {
  id: string;
  projectId: string;
  name: string;
  channel: Channel;
  status: DeliveryStatus;
  objective: string | null;
  externalId: string | null;
  position: number;
  performance: Performance;
}

export interface AdSet {
  id: string;
  campaignId: string;
  name: string;
  audience: string | null;
  status: DeliveryStatus;
  externalId: string | null;
  position: number;
  performance: Performance;
}

export interface Ad {
  id: string;
  adSetId: string;
  name: string;
  format: string | null;
  headline: string | null;
  status: DeliveryStatus;
  externalId: string | null;
  position: number;
  performance: Performance;
}

const scoped = (path: string, range: DateRange) =>
  `${path}?from=${range.from}&to=${range.to}`;

export interface CampaignReference {
  id: string;
  name: string;
  channel: Channel;
}

export interface ChannelShare {
  channel: Channel;
  campaigns: number;
  performance: Performance;
}

export const campaignsApi = {
  listByProject: (projectId: string, range: DateRange) =>
    http.get<Campaign[]>(scoped(`/projects/${projectId}/campaigns`, range)),
  namesByProject: (projectId: string) =>
    http.get<CampaignReference[]>(`/projects/${projectId}/campaigns/names`),
  get: (campaignId: string, range: DateRange) =>
    http.get<Campaign>(scoped(`/campaigns/${campaignId}`, range)),
  daily: (campaignId: string, range: DateRange) =>
    http.get<MeasuredDay[]>(scoped(`/campaigns/${campaignId}/daily`, range)),
  adSets: (campaignId: string, range: DateRange) =>
    http.get<AdSet[]>(scoped(`/campaigns/${campaignId}/ad-sets`, range)),
  ads: (adSetId: string, range: DateRange) =>
    http.get<Ad[]>(scoped(`/ad-sets/${adSetId}/ads`, range)),
  projectDaily: (projectId: string, range: DateRange) =>
    http.get<MeasuredDay[]>(scoped(`/projects/${projectId}/daily`, range)),
  projectSummary: (projectId: string, range: DateRange) =>
    http.get<Performance>(scoped(`/projects/${projectId}/summary`, range)),
  agencySummary: (range: DateRange) => http.get<Performance>(scoped("/summary", range)),
  channels: (range: DateRange) => http.get<ChannelShare[]>(scoped("/summary/channels", range)),
};
