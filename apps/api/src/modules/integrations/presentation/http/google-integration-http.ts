import { Router } from "express";
import { z } from "zod";
import type { createGoogleUseCases } from "#modules/integrations/application/google-use-cases.js";

const customerId = z.string().trim().regex(/^\d{1,20}$/);
const startSchema = z.object({ integrationId: z.uuid().optional() });
const accountsQuery = z.object({ authorization: z.uuid() });
const connectSchema = z.object({
  authorization: z.uuid(),
  accountId: customerId.optional(),
  loginCustomerId: customerId.nullish(),
});
const callbackQuery = z.object({
  state: z.string().max(200).optional(),
  code: z.string().max(4096).optional(),
});

type GoogleService = ReturnType<typeof createGoogleUseCases>;

export function addGoogleIntegrationRoutes(router: Router, service: GoogleService): void {
  router.post("/:id/integrations/google/authorize", async (req, res) => {
    const { integrationId } = startSchema.parse(req.body ?? {});
    res.json(await service.start(req.actor!, req.params.id, integrationId ?? null));
  });
  router.get("/:id/integrations/google/accounts", async (req, res) => {
    const { authorization } = accountsQuery.parse(req.query);
    res.json(await service.accounts(req.actor!, req.params.id, authorization));
  });
  router.post("/:id/integrations/google", async (req, res) => {
    const input = connectSchema.parse(req.body);
    const { renewed, integration } = await service.connect(req.actor!, req.params.id, input);
    res.status(renewed ? 200 : 201).json(integration);
  });
}

export function createGoogleCallbackRouter(service: GoogleService, appUrl: string | null) {
  const router = Router();
  router.get("/callback", async (req, res) => {
    const { state, code } = callbackQuery.parse(req.query);
    const outcome = state ? await service.complete({ state, code: code ?? null }) : { projectId: null, authorization: null };
    const base = appUrl ?? "";
    const target = outcome.projectId ? `${base}/projects/${outcome.projectId}` : `${base}/projects`;
    const result = outcome.authorization ? `google=${outcome.authorization}` : "google=failed";
    res.redirect(302, `${target}?${result}`);
  });
  return router;
}
