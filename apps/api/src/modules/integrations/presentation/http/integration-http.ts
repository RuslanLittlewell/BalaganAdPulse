import { Router } from "express";
import { z } from "zod";
import { AppError } from "#shared/domain/index.js";
import type { createIntegrationUseCases } from "../../application/integration-use-cases.js";

export const connectionSchema = z.object({
  accountId: z.string().trim().regex(/^(act_)?[0-9]{1,30}$/).transform((value) => value.replace(/^act_/, "")),
  token: z.string().trim().min(1).max(8192).regex(/^\S+$/),
});

export function createIntegrationRouter(service: ReturnType<typeof createIntegrationUseCases>) {
  const router = Router();
  router.use("/:id/integrations/meta", (req, _res, next) => {
    if (!req.actor) return next(new AppError("unauthorized", "Authentication required"));
    next();
  });
  router.get("/:id/integrations/meta", async (req, res) => { res.json(await service.read(req.actor!, req.params.id)); });
  router.put("/:id/integrations/meta", async (req, res) => { res.json(await service.connect(req.actor!, req.params.id, connectionSchema.parse(req.body))); });
  router.delete("/:id/integrations/meta", async (req, res) => { await service.disconnect(req.actor!, req.params.id); res.status(204).send(); });
  router.post("/:id/integrations/meta/sync", async (req, res) => { res.status(202).json(await service.sync(req.actor!, req.params.id)); });
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
