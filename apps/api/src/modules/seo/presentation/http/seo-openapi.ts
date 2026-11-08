import { z } from "zod";
import type { RouteDoc } from "#shared/presentation/openapi.js";

const site = z.object({
  id: z.uuid(),
  siteUrl: z.string(),
  label: z.string(),
  status: z.enum(["QUEUED", "RUNNING", "SUCCESS", "ERROR", "AUTH_REQUIRED"]),
  lastSuccessAt: z.iso.datetime().nullable(),
  lastError: z.string().nullable(),
  checkStatus: z.enum(["QUEUED", "RUNNING", "SUCCESS", "ERROR"]),
  lastCheckAt: z.iso.datetime().nullable(),
  checkError: z.string().nullable(),
  analytics: z.object({
    propertyId: z.string(),
    name: z.string(),
    status: z.enum(["QUEUED", "RUNNING", "SUCCESS", "ERROR", "AUTH_REQUIRED"]),
    lastSuccessAt: z.iso.datetime().nullable(),
    lastError: z.string().nullable(),
  }).nullable(),
});

export const seoConnectionDoc: RouteDoc = {
  tag: "SEO",
  tagDescription: "Members who manage integrations connect a project to its sites in Google Search Console by signing in with Google. Everyone who reads the project reads the sites' search figures, Core Web Vitals and page checks. Credentials are never returned.",
  operations: [
    { method: "post", path: "/:id/seo/authorize", summary: "Start a Google sign-in for Search Console, for a new site or to renew one", body: z.object({ siteId: z.uuid().optional() }), bodyRequired: false, success: { status: 200, description: "The Google consent address to send the member to", schema: z.object({ url: z.url() }) }, errors: [400, 401, 403, 404] },
    { method: "get", path: "/:id/seo/authorizations/:authorization/sites", summary: "List the verified Search Console sites a completed sign-in reaches and the project does not hold yet", success: { status: 200, description: "Sites and Google Analytics 4 properties to choose from; both empty while renewing, and no properties when the sign-in did not grant Analytics", schema: z.object({ renewing: z.boolean(), sites: z.array(z.object({ siteUrl: z.string(), label: z.string(), permissionLevel: z.string() })), properties: z.array(z.object({ propertyId: z.string(), name: z.string() })) }) }, errors: [400, 401, 403, 404] },
    { method: "get", path: "/:id/seo/sites", summary: "List the project's connected sites and the state of their imports and page checks", success: { status: 200, description: "Connected sites, oldest first", schema: z.array(site) }, errors: [401, 404] },
    { method: "post", path: "/:id/seo/sites", summary: "Connect the chosen site, with a Google Analytics 4 property if one is chosen, or renew the sign-in of the site it was started for; queue an import and a page check", body: z.object({ authorization: z.uuid(), siteUrl: z.string().min(1).max(2048).optional(), propertyId: z.string().regex(/^\d{1,20}$/).optional() }), success: { status: 201, description: "The connected site. 200 when an existing site was renewed", schema: site }, errors: [400, 401, 403, 404, 409] },
    { method: "post", path: "/:id/seo/sites/:siteId/sync", summary: "Queue an import of search figures and Core Web Vitals, joining one already queued", success: { status: 202, description: "The site with its import state", schema: site }, errors: [401, 403, 404] },
    { method: "post", path: "/:id/seo/sites/:siteId/audit", summary: "Queue a page check, joining one already queued or running", success: { status: 202, description: "The site with its page check state", schema: site }, errors: [401, 403, 404] },
    { method: "post", path: "/:id/seo/sites/:siteId/analytics/authorize", summary: "Start a Google sign-in that adds read access to Analytics to the site's credential", success: { status: 200, description: "The Google consent address to send the member to", schema: z.object({ url: z.url() }) }, errors: [401, 403, 404] },
    { method: "get", path: "/:id/seo/analytics-authorizations/:authorization/properties", summary: "List the Google Analytics 4 properties a completed Analytics sign-in reaches", success: { status: 200, description: "The site the sign-in was started for and the properties to choose from", schema: z.object({ siteId: z.uuid().nullable(), properties: z.array(z.object({ propertyId: z.string(), name: z.string() })) }) }, errors: [400, 401, 403, 404] },
    { method: "put", path: "/:id/seo/sites/:siteId/analytics", summary: "Link a Google Analytics 4 property to the site, replacing a linked one and its traffic data, and queue a traffic import", body: z.object({ authorization: z.uuid(), propertyId: z.string().regex(/^\d{1,20}$/) }), success: { status: 200, description: "The site with its linked property", schema: site }, errors: [400, 401, 403, 404] },
    { method: "delete", path: "/:id/seo/sites/:siteId/analytics", summary: "Unlink the Analytics property and delete the site's traffic data, leaving Search Console untouched", success: { status: 200, description: "The site without a property", schema: site }, errors: [401, 403, 404] },
    { method: "delete", path: "/:id/seo/sites/:siteId", summary: "Disconnect a site and delete its credential and SEO data", success: { status: 204, description: "Disconnected" }, errors: [401, 403, 404] },
  ],
};

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const range = z.object({ from: day, to: day });
const totals = z.object({ clicks: z.int(), impressions: z.int(), ctr: z.number().nullable(), position: z.number().nullable() });
const rating = z.enum(["GOOD", "NEEDS_IMPROVEMENT", "POOR"]);

export const seoReadDoc: RouteDoc = {
  tag: "SEO",
  operations: [
    {
      method: "get", path: "/:id/seo/sites/:siteId/search", summary: "Read a site's search figures for a period, with the period before it and each day", query: range,
      success: { status: 200, description: "Clicks, impressions, CTR as a fraction and the impression-weighted average position; latestDay is the last day Search Console has figures for", schema: z.object({
        from: day, to: day, latestDay: day.nullable(), totals, previous: totals, days: z.array(totals.extend({ date: day })),
      }) },
      errors: [400, 401, 404],
    },
    {
      method: "get", path: "/:id/seo/sites/:siteId/top", summary: "Rank a site's queries or pages by clicks for a period, within the 90 days they are kept",
      query: range.extend({ kind: z.enum(["query", "page"]), limit: z.int().min(1).max(100).optional() }),
      success: { status: 200, description: "The ranked items; partial and from tell when the period reaches past the kept days", schema: z.object({
        kind: z.enum(["query", "page"]), from: day, to: day, partial: z.boolean(), totalClicks: z.int(),
        items: z.array(z.object({ key: z.string(), clicks: z.int(), impressions: z.int(), ctr: z.number().nullable(), position: z.number().nullable(), share: z.number().nullable() })),
      }) },
      errors: [400, 401, 404],
    },
    {
      method: "get", path: "/:id/seo/sites/:siteId/traffic", summary: "Read a site's sessions by channel, by source and medium, and by day for a period, with the previous period of the same length", query: range,
      success: { status: 200, description: "connected is false when no Analytics property is linked", schema: z.union([
        z.object({ connected: z.literal(false) }),
        z.object({
          connected: z.literal(true),
          propertyName: z.string(),
          status: z.enum(["QUEUED", "RUNNING", "SUCCESS", "ERROR", "AUTH_REQUIRED"]),
          lastSuccessAt: z.iso.datetime().nullable(),
          lastError: z.string().nullable(),
          from: day,
          to: day,
          totalSessions: z.int(),
          previousSessions: z.int(),
          channels: z.array(z.object({ channel: z.string(), sessions: z.int(), share: z.number(), previous: z.int() })),
          sources: z.array(z.object({ source: z.string(), medium: z.string(), sessions: z.int(), share: z.number() })),
          days: z.array(z.object({ date: day, sessions: z.int() })),
        }),
      ]) },
      errors: [400, 401, 404],
    },
    {
      method: "get", path: "/:id/seo/sites/:siteId/vitals", summary: "Read a site's Core Web Vitals by device, their weekly history in a period, and the home page's lab measurement", query: range,
      success: { status: 200, description: "Field data at the 75th percentile rated by Google's thresholds; configured is false when the server has no Google API key", schema: z.object({
        configured: z.boolean(),
        readAt: z.iso.datetime().nullable(),
        devices: z.array(z.object({
          device: z.enum(["PHONE", "DESKTOP"]),
          periodEnd: day.nullable(),
          passes: z.boolean().nullable(),
          metrics: z.array(z.object({
            metric: z.enum(["LCP", "INP", "CLS", "FCP", "TTFB"]), p75: z.number(), rating, good: z.number(), needsImprovement: z.number(), poor: z.number(),
            weeks: z.array(z.object({ periodEnd: day, p75: z.number() })),
          })),
          lab: z.object({
            device: z.enum(["PHONE", "DESKTOP"]), measuredAt: z.iso.datetime(), score: z.int(), rating,
            lcpMs: z.int(), cls: z.number(), tbtMs: z.int(), fcpMs: z.int(), speedIndexMs: z.int(),
          }).nullable(),
        })),
      }) },
      errors: [400, 401, 404],
    },
  ],
};

const problemKind = z.enum(["HTTP_ERROR", "UNREACHABLE", "ROBOTS_BLOCKED", "NOINDEX", "TITLE_MISSING", "JSON_LD_INVALID", "TITLE_LONG", "TITLE_DUPLICATE", "DESCRIPTION_MISSING", "DESCRIPTION_LONG", "DESCRIPTION_DUPLICATE", "H1_MISSING", "H1_MULTIPLE", "CANONICAL_ELSEWHERE", "SITEMAP_REDIRECT", "JSON_LD_UNTYPED"]);
const severity = z.enum(["ERROR", "WARNING"]);
const listedPage = z.object({
  id: z.uuid(), url: z.string(), status: z.int().nullable(), outcome: z.enum(["FETCHED", "BLOCKED", "UNREACHABLE", "OFF_SITE_REDIRECT"]),
  problems: z.array(z.object({ kind: problemKind, severity })),
});
const facts = z.object({
  lang: z.string().nullable(), title: z.string().nullable(), description: z.string().nullable(), keywords: z.string().nullable(),
  robots: z.array(z.string()), canonical: z.string().nullable(), h1: z.array(z.string()), openGraph: z.record(z.string(), z.string()),
  jsonLd: z.array(z.object({ source: z.string(), types: z.array(z.string()), error: z.string().nullable() })),
});

export const seoAuditDoc: RouteDoc = {
  tag: "SEO",
  operations: [
    {
      method: "get", path: "/:id/seo/sites/:siteId/audit", summary: "Read the state of a site's page check and the problems of its latest finished check grouped by kind",
      success: { status: 200, description: "Counts and problem kinds, errors first; result is null before the first check finishes", schema: z.object({
        status: z.enum(["QUEUED", "RUNNING", "SUCCESS", "ERROR"]), lastCheckAt: z.iso.datetime().nullable(), checkError: z.string().nullable(),
        result: z.object({
          finishedAt: z.iso.datetime(), checked: z.int(), notChecked: z.int(), pagesWithErrors: z.int(), pagesWithWarnings: z.int(),
          kinds: z.array(z.object({ kind: problemKind, severity, pages: z.int() })),
        }).nullable(),
      }) },
      errors: [401, 404],
    },
    {
      method: "get", path: "/:id/seo/sites/:siteId/audit/pages", summary: "List the checked pages, or only those with one kind of problem", query: z.object({ kind: problemKind.optional() }),
      success: { status: 200, description: "Pages of the latest check with their problems", schema: z.array(listedPage) },
      errors: [400, 401, 404],
    },
    {
      method: "get", path: "/:id/seo/sites/:siteId/audit/pages/:pageId", summary: "Read everything the check collected from one page, with its search figures in a period", query: range,
      success: { status: 200, description: "The page's SEO data; facts is null for a page that was not read as HTML", schema: listedPage.extend({
        finalUrl: z.string().nullable(), contentType: z.string().nullable(), responseMs: z.int().nullable(), inSitemap: z.boolean(), hasImpressions: z.boolean(),
        facts: facts.nullable(),
        search: z.object({ clicks: z.int(), impressions: z.int(), position: z.number().nullable() }).nullable(),
      }) },
      errors: [400, 401, 404],
    },
  ],
};

export { site as seoSiteSchema };
