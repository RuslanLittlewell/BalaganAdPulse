import { Router } from "express";
import { z } from "zod";
import { AppError } from "#shared/domain/index.js";
import type { createSiteUseCases } from "#modules/seo/application/site-use-cases.js";
import type { createTrafficUseCases } from "#modules/seo/application/traffic-use-cases.js";
import type { createReadUseCases } from "#modules/seo/application/read-use-cases.js";
import { seoKindSchema, seoRangeSchema, seoTopSchema } from "./seo-schemas.js";

type SiteUseCases = ReturnType<typeof createSiteUseCases>;
type TrafficUseCases = ReturnType<typeof createTrafficUseCases>;
type ReadUseCases = ReturnType<typeof createReadUseCases>;

const startSchema = z.object({ siteId: z.uuid().optional() });
const linkSchema = z.object({ authorization: z.uuid(), propertyId: z.string().regex(/^\d{1,20}$/) });
const connectSchema = z.object({ authorization: z.uuid(), siteUrl: z.string().trim().min(1).max(2048).optional(), propertyId: z.string().regex(/^\d{1,20}$/).optional() });

export function createSeoRouter(sites: SiteUseCases, reads: ReadUseCases, traffic: TrafficUseCases, addMore: (router: Router) => void = () => {}): Router {
  const router = Router();
  router.use("/:id/seo", (req, _res, next) => {
    next(req.actor ? undefined : new AppError("unauthorized", "Authentication required"));
  });
  router.post("/:id/seo/authorize", async (req, res) => {
    const { siteId } = startSchema.parse(req.body ?? {});
    res.json(await sites.start(req.actor!, req.params.id, siteId ?? null));
  });
  router.get("/:id/seo/authorizations/:authorization/sites", async (req, res) => {
    const authorization = z.uuid().parse(req.params.authorization);
    res.json(await sites.choices(req.actor!, req.params.id, authorization));
  });
  router.get("/:id/seo/sites", async (req, res) => {
    res.json(await sites.list(req.actor!, req.params.id));
  });
  router.post("/:id/seo/sites", async (req, res) => {
    const { renewed, site } = await sites.connect(req.actor!, req.params.id, connectSchema.parse(req.body));
    res.status(renewed ? 200 : 201).json(site);
  });
  router.post("/:id/seo/sites/:siteId/sync", async (req, res) => {
    res.status(202).json(await sites.sync(req.actor!, req.params.id, req.params.siteId));
  });
  router.post("/:id/seo/sites/:siteId/audit", async (req, res) => {
    res.status(202).json(await sites.check(req.actor!, req.params.id, req.params.siteId));
  });
  router.post("/:id/seo/sites/:siteId/analytics/authorize", async (req, res) => {
    res.json(await traffic.start(req.actor!, req.params.id, req.params.siteId));
  });
  router.get("/:id/seo/analytics-authorizations/:authorization/properties", async (req, res) => {
    res.json(await traffic.properties(req.actor!, req.params.id, z.uuid().parse(req.params.authorization)));
  });
  router.put("/:id/seo/sites/:siteId/analytics", async (req, res) => {
    res.json(await traffic.link(req.actor!, req.params.id, req.params.siteId, linkSchema.parse(req.body)));
  });
  router.delete("/:id/seo/sites/:siteId/analytics", async (req, res) => {
    res.json(await traffic.unlink(req.actor!, req.params.id, req.params.siteId));
  });
  router.get("/:id/seo/sites/:siteId/traffic", async (req, res) => {
    res.json(await reads.traffic(req.actor!, req.params.id, req.params.siteId, seoRangeSchema.parse(req.query)));
  });
  router.delete("/:id/seo/sites/:siteId", async (req, res) => {
    await sites.disconnect(req.actor!, req.params.id, req.params.siteId);
    res.status(204).send();
  });
  router.get("/:id/seo/sites/:siteId/search", async (req, res) => {
    res.json(await reads.search(req.actor!, req.params.id, req.params.siteId, seoRangeSchema.parse(req.query)));
  });
  router.get("/:id/seo/sites/:siteId/top", async (req, res) => {
    const { kind, limit, ...range } = seoTopSchema.parse(req.query);
    res.json(await reads.top(req.actor!, req.params.id, req.params.siteId, kind, range, limit));
  });
  router.get("/:id/seo/sites/:siteId/vitals", async (req, res) => {
    res.json(await reads.vitals(req.actor!, req.params.id, req.params.siteId, seoRangeSchema.parse(req.query)));
  });
  router.get("/:id/seo/sites/:siteId/audit", async (req, res) => {
    res.json(await reads.audit(req.actor!, req.params.id, req.params.siteId));
  });
  router.get("/:id/seo/sites/:siteId/audit/pages", async (req, res) => {
    const { kind } = seoKindSchema.parse(req.query);
    res.json(await reads.auditPages(req.actor!, req.params.id, req.params.siteId, kind ?? null));
  });
  router.get("/:id/seo/sites/:siteId/audit/pages/:pageId", async (req, res) => {
    res.json(await reads.auditPage(req.actor!, req.params.id, req.params.siteId, req.params.pageId, seoRangeSchema.parse(req.query)));
  });
  addMore(router);
  return router;
}
