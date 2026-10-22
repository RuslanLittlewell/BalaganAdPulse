import { http } from "@/shared/lib/index.js";

export const CHANNELS = ["META", "GOOGLE", "YANDEX", "VK", "TIKTOK", "LINKEDIN", "TELEGRAM"] as const;
export type Channel = (typeof CHANNELS)[number];

export const DELIVERY_STATUSES = ["ACTIVE", "LEARNING", "PAUSED", "REJECTED", "ENDED"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const RESULT_TYPES = [
  "MESSAGES", "PROFILE_VISITS", "LEADS", "LINK_CLICKS", "LANDING_PAGE_VIEWS", "CONVERSIONS",
  "ENGAGEMENT", "REACH", "VIDEO_VIEWS", "APP_INSTALLS", "OTHER", "UNKNOWN",
] as const;
export type ResultType = (typeof RESULT_TYPES)[number];

export interface ResultTypeFigure {
  type: ResultType;
  results: number;
  spend: number;
}

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
  results: number;
  revenue: number;
  resultTypes?: ResultTypeFigure[];
}

export interface Derived {
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cpa: number | null;
  costPerResult: number | null;
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
  sourceAccountId: string | null;
  position: number;
  kpi: { metric: string; target: string } | null;
  performance: Performance;
  resultTypes: ResultType[];
}

export interface AdSet {
  id: string;
  campaignId: string;
  name: string;
  audience: string | null;
  resultType: ResultType;
  status: DeliveryStatus;
  externalId: string | null;
  position: number;
  performance: Performance;
}

export const CREATIVE_KINDS = ["IMAGE", "VIDEO", "TEXT"] as const;

export type CreativeKind = (typeof CREATIVE_KINDS)[number];

export interface Creative {
  id: string;
  position: number;
  kind: CreativeKind;
  title: string | null;
  body: string | null;
  hasFile: boolean;
  hasPoster: boolean;
  sourceUrl: string | null;
}

export interface Ad {
  id: string;
  adSetId: string;
  name: string;
  format: string | null;
  headline: string | null;
  resultType: ResultType;
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


export interface CurrencyPerformance {
  currency: string | null;
  performance: Performance;
}

export interface ProjectFigures {
  projectId: string;
  kpis: Array<{ metric: string; target: string; name?: string; value?: string; resultType?: string; enabled: boolean }>;
  performance: Performance;
  days: MeasuredDay[];
}

export interface ChannelShare {
  currency: string | null;
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
  agencySummary: (range: DateRange) => http.get<CurrencyPerformance[]>(scoped("/summary", range)),
  projectsSummary: (range: DateRange) => http.get<ProjectFigures[]>(scoped("/summary/projects", range)),
  adCreatives: (adId: string) => http.get<Creative[]>(`/ads/${adId}/creatives`),
  adPreview: (adId: string) => http.get<{ url: string }>(`/ads/${adId}/preview`),
  creativeFile: async (creativeId: string, part: "file" | "poster") => {
    const blob = await http.getBlob(`/ad-creatives/${creativeId}/${part}`);
    return URL.createObjectURL(blob);
  },
  channels: (range: DateRange) => http.get<ChannelShare[]>(scoped("/summary/channels", range)),
};
