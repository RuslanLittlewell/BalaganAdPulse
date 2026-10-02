import { Router } from "express";
import { z } from "zod";
import { AppError } from "#shared/domain/index.js";
import type { createIntegrationUseCases } from "../../application/integration-use-cases.js";

export const connectionSchema = z.object({
  accountId: z.string().trim().regex(/^(act_)?[0-9]{1,30}$/).transform((value) => value.replace(/^act_/, "")),
  token: z.string().trim().min(1).max(8192).regex(/^\S+$/),
});

export const settingsSchema = z.object({ leadsEnabled: z.boolean() });
export const newConnectionSchema = connectionSchema.extend({ leadsEnabled: z.boolean().optional() });

export function createIntegrationRouter(service: ReturnType<typeof createIntegrationUseCases>) {
  const router = Router();
  router.use("/:id/integrations", (req, _res, next) => {
    if (!req.actor) return next(new AppError("unauthorized", "Authentication required"));
    next();
  });
  router.get("/:id/integrations", async (req, res) => { res.json(await service.list(req.actor!, req.params.id)); });
  router.post("/:id/integrations/meta", async (req, res) => { res.status(201).json(await service.connect(req.actor!, req.params.id, newConnectionSchema.parse(req.body))); });
  router.put("/:id/integrations/:integrationId", async (req, res) => { res.json(await service.replace(req.actor!, req.params.id, req.params.integrationId, connectionSchema.parse(req.body))); });
  router.patch("/:id/integrations/:integrationId", async (req, res) => { res.json(await service.setLeadsEnabled(req.actor!, req.params.id, req.params.integrationId, settingsSchema.parse(req.body).leadsEnabled)); });
  router.delete("/:id/integrations/:integrationId", async (req, res) => { await service.disconnect(req.actor!, req.params.id, req.params.integrationId); res.status(204).send(); });
  router.post("/:id/integrations/:integrationId/sync", async (req, res) => { res.status(202).json(await service.sync(req.actor!, req.params.id, req.params.integrationId)); });
  return router;
}

export function createAdPreviewRouter(service: ReturnType<typeof createIntegrationUseCases>) {
  const router = Router();
  router.use("/:id", (req, _res, next) => {
    next(req.actor ? undefined : new AppError("unauthorized", "Authentication required"));
  });
  router.get("/:id/preview", async (req, res, next) => {
    try {
      res.json(await service.adPreview(req.actor!, req.params.id));
    } catch (error) {
      next(error);
    }
  });
  router.get("/:id/creatives", async (req, res, next) => {
    try {
      res.json(await service.adCreatives(req.actor!, req.params.id));
    } catch (error) {
      next(error);
    }
  });
  return router;
}
