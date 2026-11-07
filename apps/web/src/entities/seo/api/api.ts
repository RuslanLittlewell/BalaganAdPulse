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
}

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
  sites: (projectId: string) => http.get<SeoSite[]>(`${base(projectId)}/sites`),
  authorize: (projectId: string, siteId?: string) =>
    http.post<{ url: string }>(`${base(projectId)}/authorize`, siteId ? { siteId } : {}),
  choices: (projectId: string, authorization: string) =>
    http.get<{ renewing: boolean; sites: SeoSiteChoice[] }>(`${base(projectId)}/authorizations/${authorization}/sites`),
  connect: (projectId: string, body: { authorization: string; siteUrl?: string }) =>
    http.post<SeoSite>(`${base(projectId)}/sites`, body),
  sync: (projectId: string, siteId: string) => http.post<SeoSite>(`${site(projectId, siteId)}/sync`, {}),
  check: (projectId: string, siteId: string) => http.post<SeoSite>(`${site(projectId, siteId)}/audit`, {}),
  disconnect: (projectId: string, siteId: string) => http.del(site(projectId, siteId)),
  search: (projectId: string, siteId: string, range: SeoRange) =>
    http.get<SeoSearch>(`${site(projectId, siteId)}/search?${query({ ...range })}`),
  top: (projectId: string, siteId: string, kind: SeoTopKind, range: SeoRange, limit: number) =>
    http.get<SeoTop>(`${site(projectId, siteId)}/top?${query({ ...range, kind, limit })}`),
  vitals: (projectId: string, siteId: string, range: SeoRange) =>
    http.get<SeoVitals>(`${site(projectId, siteId)}/vitals?${query({ ...range })}`),
  audit: (projectId: string, siteId: string) => http.get<SeoAudit>(`${site(projectId, siteId)}/audit`),
  auditPages: (projectId: string, siteId: string, kind?: SeoProblemKind) =>
    http.get<SeoAuditListedPage[]>(`${site(projectId, siteId)}/audit/pages${kind ? `?${query({ kind })}` : ""}`),
  auditPage: (projectId: string, siteId: string, pageId: string, range: SeoRange) =>
    http.get<SeoAuditPage>(`${site(projectId, siteId)}/audit/pages/${pageId}?${query({ ...range })}`),
};
