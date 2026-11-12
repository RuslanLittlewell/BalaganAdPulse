import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import type { OptionalModule } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import { createRateLimit } from "#shared/presentation/rate-limit.js";
import { createSharedLinkDescription, createSharedLinkOpening } from "#modules/share-links/index.js";
import type { ApiContainer } from "./create-container.js";

const SOURCES = {
  "project-metrics": { mount: "/projects/:projectId", router: (c: ApiContainer) => c.projectMetricRouter },
  kpi: { mount: "/", router: (c: ApiContainer) => c.kpiRouter },
  "summary-tiles": { mount: "/", router: (c: ApiContainer) => c.summaryTileRouter },
  leads: { mount: "/crm", router: (c: ApiContainer) => c.leadRouter },
  seo: { mount: "/projects", router: (c: ApiContainer) => c.seoRouter },
  campaigns: { mount: "/campaigns", router: (c: ApiContainer) => c.campaignRouter },
  "ad-sets": { mount: "/ad-sets", router: (c: ApiContainer) => c.adSetRouter },
  "ad-creatives": { mount: "/ad-creatives", router: (c: ApiContainer) => c.adCreativeRouter },
  "ad-previews": { mount: "/ads", router: (c: ApiContainer) => c.adPreviewRouter },
} as const;

export type SharedSource = keyof typeof SOURCES;

export interface SharedRead {
  readonly source: SharedSource;
  readonly path: string;
  readonly module?: OptionalModule;
  readonly callsPlatform?: true;
}

export const SHARED_READS: readonly SharedRead[] = [
  { source: "project-metrics", path: "/summary" },
  { source: "project-metrics", path: "/campaigns" },
  { source: "kpi", path: "/projects/:id/kpis" },
  { source: "kpi", path: "/campaigns/:id/kpi" },
  { source: "summary-tiles", path: "/projects/:id/summary-tiles" },
  { source: "leads", path: "/boards/:boardKey/stage-counts", module: "CRM" },
  { source: "seo", path: "/:id/seo/sites" },
  { source: "seo", path: "/:id/seo/sites/:siteId/traffic" },
  { source: "seo", path: "/:id/seo/sites/:siteId/search" },
  { source: "seo", path: "/:id/seo/sites/:siteId/top" },
  { source: "seo", path: "/:id/seo/sites/:siteId/vitals" },
  { source: "seo", path: "/:id/seo/sites/:siteId/audit" },
  { source: "seo", path: "/:id/seo/sites/:siteId/audit/pages" },
  { source: "seo", path: "/:id/seo/sites/:siteId/audit/pages/:pageId" },
  { source: "campaigns", path: "/:id" },
  { source: "campaigns", path: "/:id/daily" },
  { source: "campaigns", path: "/:id/ad-sets" },
  { source: "ad-sets", path: "/:id/ads" },
  { source: "ad-creatives", path: "/:id/file" },
  { source: "ad-creatives", path: "/:id/poster" },
  { source: "ad-previews", path: "/:id/preview", callsPlatform: true },
  { source: "ad-previews", path: "/:id/creatives", callsPlatform: true },
];

export const sharedPath = ({ source, path }: SharedRead): string =>
  `${SOURCES[source].mount}/${path}`.replace(/\/{2,}/g, "/").replace(/(.)\/$/, "$1");

export interface SharedReadLimits {
  readonly perAddress: number;
  readonly platformCallsPerLink: number;
}

export const SHARED_READ_LIMITS: SharedReadLimits = { perAddress: 300, platformCallsPerLink: 30 };

const MINUTE = 60_000;

function keepOutOfSearch(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
}

export function createSharedRouter(container: ApiContainer, limits: SharedReadLimits = SHARED_READ_LIMITS): Router {
  const router = Router({ mergeParams: true });
  const platformLimit = createRateLimit({
    windowMs: MINUTE,
    limit: limits.platformCallsPerLink,
    keyOf: (req) => String(req.params.token),
  });
  router.use(keepOutOfSearch);
  router.use(createRateLimit({ windowMs: MINUTE, limit: limits.perAddress }));
  router.use(createSharedLinkOpening(container.shareLinks));
  router.get("/", createSharedLinkDescription(container.shareLinks));
  for (const read of SHARED_READS) {
    const delegate = Router().use(SOURCES[read.source].mount, SOURCES[read.source].router(container));
    const guards: RequestHandler[] = [
      ...(read.module ? [container.requireModule(read.module)] : []),
      ...(read.callsPlatform ? [platformLimit] : []),
    ];
    router.get(sharedPath(read), ...guards, (req, res, next) => delegate(req, res, next));
  }
  router.use((_req, _res, next) => next(new AppError("not-found", "Endpoint not found")));
  return router;
}
