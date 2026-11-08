import { http } from "@/shared/lib/index.js";

export type SeoImportStatus = "QUEUED" | "RUNNING" | "SUCCESS" | "ERROR" | "AUTH_REQUIRED";
export type SeoCheckStatus = "QUEUED" | "RUNNING" | "SUCCESS" | "ERROR";
export type SeoDevice = "PHONE" | "DESKTOP";
export type SeoMetric = "LCP" | "INP" | "CLS" | "FCP" | "TTFB";
export type SeoRating = "GOOD" | "NEEDS_IMPROVEMENT" | "POOR";
export type SeoTopKind = "query" | "page";
export type SeoSeverity = "ERROR" | "WARNING";
export type SeoProblemKind =
  | "HTTP_ERROR" | "UNREACHABLE" | "ROBOTS_BLOCKED" | "NOINDEX" | "TITLE_MISSING" | "JSON_LD_INVALID"
  | "TITLE_LONG" | "TITLE_DUPLICATE" | "DESCRIPTION_MISSING" | "DESCRIPTION_LONG" | "DESCRIPTION_DUPLICATE"
  | "H1_MISSING" | "H1_MULTIPLE" | "CANONICAL_ELSEWHERE" | "SITEMAP_REDIRECT" | "JSON_LD_UNTYPED";

export interface SeoSite {
  id: string;
  siteUrl: string;
  label: string;
  status: SeoImportStatus;
  lastSuccessAt: string | null;
  lastError: string | null;
  checkStatus: SeoCheckStatus;
  lastCheckAt: string | null;
  checkError: string | null;
  analytics: SeoAnalyticsLink | null;
}

export interface SeoAnalyticsLink {
  propertyId: string;
  name: string;
  status: SeoImportStatus;
  lastSuccessAt: string | null;
  lastError: string | null;
}

export interface SeoPropertyChoice {
  propertyId: string;
  name: string;
}

export interface SeoTrafficChannel {
  channel: string;
  sessions: number;
  share: number;
  previous: number;
}

export interface SeoTrafficSource {
  source: string;
  medium: string;
  sessions: number;
  share: number;
}

export type SeoTraffic =
  | { connected: false }
  | {
      connected: true;
      propertyName: string;
      status: SeoImportStatus;
      lastSuccessAt: string | null;
      lastError: string | null;
      from: string;
      to: string;
      totalSessions: number;
      previousSessions: number;
      channels: SeoTrafficChannel[];
      sources: SeoTrafficSource[];
      days: { date: string; sessions: number }[];
    };

export interface SeoSiteChoice {
  siteUrl: string;
  label: string;
  permissionLevel: string;
}

export interface SeoTotals {
  clicks: number;
  impressions: number;
  ctr: number | null;
  position: number | null;
}

export interface SeoSearch {
  from: string;
  to: string;
  latestDay: string | null;
  totals: SeoTotals;
  previous: SeoTotals;
  days: (SeoTotals & { date: string })[];
}

export interface SeoTopItem extends SeoTotals {
  key: string;
  share: number | null;
}

export interface SeoTop {
  kind: SeoTopKind;
  from: string;
  to: string;
  partial: boolean;
  totalClicks: number;
  items: SeoTopItem[];
}

export interface SeoVitalMetric {
  metric: SeoMetric;
  p75: number;
  rating: SeoRating;
  good: number;
  needsImprovement: number;
  poor: number;
  weeks: { periodEnd: string; p75: number }[];
}

export interface SeoLab {
  device: SeoDevice;
  measuredAt: string;
  score: number;
  rating: SeoRating;
  lcpMs: number;
  cls: number;
  tbtMs: number;
  fcpMs: number;
  speedIndexMs: number;
}

export interface SeoDeviceVitals {
  device: SeoDevice;
  periodEnd: string | null;
  passes: boolean | null;
  metrics: SeoVitalMetric[];
  lab: SeoLab | null;
}

export interface SeoVitals {
  configured: boolean;
  readAt: string | null;
  devices: SeoDeviceVitals[];
}

export interface SeoProblem {
  kind: SeoProblemKind;
  severity: SeoSeverity;
}

export interface SeoAudit {
  status: SeoCheckStatus;
  lastCheckAt: string | null;
  checkError: string | null;
  result: {
    finishedAt: string;
    checked: number;
    notChecked: number;
    pagesWithErrors: number;
    pagesWithWarnings: number;
    kinds: (SeoProblem & { pages: number })[];
  } | null;
}

export interface SeoAuditListedPage {
  id: string;
  url: string;
  status: number | null;
  outcome: "FETCHED" | "BLOCKED" | "UNREACHABLE" | "OFF_SITE_REDIRECT";
  problems: SeoProblem[];
}

export interface SeoPageFacts {
  lang: string | null;
  title: string | null;
  description: string | null;
  keywords: string | null;
  robots: string[];
  canonical: string | null;
  h1: string[];
  openGraph: Record<string, string>;
  jsonLd: { source: string; types: string[]; error: string | null }[];
}

export interface SeoAuditPage extends SeoAuditListedPage {
  finalUrl: string | null;
  contentType: string | null;
  responseMs: number | null;
  inSitemap: boolean;
  hasImpressions: boolean;
  facts: SeoPageFacts | null;
  search: { clicks: number; impressions: number; position: number | null } | null;
}

export interface SeoRange {
  from: string;
  to: string;
}

const base = (projectId: string) => `/projects/${projectId}/seo`;
const site = (projectId: string, siteId: string) => `${base(projectId)}/sites/${siteId}`;
const query = (values: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(values).flatMap(([key, value]) => (value === undefined ? [] : [[key, String(value)]]))).toString();

export const seoApi = {
  sites: (projectId: string, signal?: AbortSignal) => http.get<SeoSite[]>(`${base(projectId)}/sites`, { signal }),
  authorize: (projectId: string, siteId?: string) =>
    http.post<{ url: string }>(`${base(projectId)}/authorize`, siteId ? { siteId } : {}),
  choices: (projectId: string, authorization: string) =>
    http.get<{ renewing: boolean; sites: SeoSiteChoice[]; properties: SeoPropertyChoice[] }>(`${base(projectId)}/authorizations/${authorization}/sites`),
  connect: (projectId: string, body: { authorization: string; siteUrl?: string; propertyId?: string }) =>
    http.post<SeoSite>(`${base(projectId)}/sites`, body),
  sync: (projectId: string, siteId: string) => http.post<SeoSite>(`${site(projectId, siteId)}/sync`, {}),
  check: (projectId: string, siteId: string) => http.post<SeoSite>(`${site(projectId, siteId)}/audit`, {}),
  disconnect: (projectId: string, siteId: string) => http.del(site(projectId, siteId)),
  authorizeAnalytics: (projectId: string, siteId: string) =>
    http.post<{ url: string }>(`${site(projectId, siteId)}/analytics/authorize`, {}),
  properties: (projectId: string, authorization: string) =>
    http.get<{ siteId: string | null; properties: SeoPropertyChoice[] }>(`${base(projectId)}/analytics-authorizations/${authorization}/properties`),
  linkAnalytics: (projectId: string, siteId: string, body: { authorization: string; propertyId: string }) =>
    http.put<SeoSite>(`${site(projectId, siteId)}/analytics`, body),
  unlinkAnalytics: (projectId: string, siteId: string) => http.del(`${site(projectId, siteId)}/analytics`),
  traffic: (projectId: string, siteId: string, range: SeoRange, signal?: AbortSignal) =>
    http.get<SeoTraffic>(`${site(projectId, siteId)}/traffic?${query({ ...range })}`, { signal }),
  search: (projectId: string, siteId: string, range: SeoRange, signal?: AbortSignal) =>
    http.get<SeoSearch>(`${site(projectId, siteId)}/search?${query({ ...range })}`, { signal }),
  top: (projectId: string, siteId: string, kind: SeoTopKind, range: SeoRange, limit: number, signal?: AbortSignal) =>
    http.get<SeoTop>(`${site(projectId, siteId)}/top?${query({ ...range, kind, limit })}`, { signal }),
  vitals: (projectId: string, siteId: string, range: SeoRange, signal?: AbortSignal) =>
    http.get<SeoVitals>(`${site(projectId, siteId)}/vitals?${query({ ...range })}`, { signal }),
  audit: (projectId: string, siteId: string, signal?: AbortSignal) => http.get<SeoAudit>(`${site(projectId, siteId)}/audit`, { signal }),
  auditPages: (projectId: string, siteId: string, kind?: SeoProblemKind, signal?: AbortSignal) =>
    http.get<SeoAuditListedPage[]>(`${site(projectId, siteId)}/audit/pages${kind ? `?${query({ kind })}` : ""}`, { signal }),
  auditPage: (projectId: string, siteId: string, pageId: string, range: SeoRange, signal?: AbortSignal) =>
    http.get<SeoAuditPage>(`${site(projectId, siteId)}/audit/pages/${pageId}?${query({ ...range })}`, { signal }),
};
