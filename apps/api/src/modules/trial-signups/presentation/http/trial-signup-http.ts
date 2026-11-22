import { Router, type NextFunction, type Request, type Response } from "express";
import { createRateLimit } from "#shared/presentation/rate-limit.js";
import { setAuthCookies } from "#modules/identity/index.js";
import type { TrialSignupUseCases } from "#modules/trial-signups/application/trial-signup-use-cases.js";
import { trialSignupSchema } from "./trial-signup-schemas.js";

const resets = new Set<() => void>();
export function resetTrialSignupRateLimits(): void { resets.forEach((reset) => reset()); }

function emailOf(req: Request): string {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function handle(action: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

export function createTrialSignupRouter(useCases: TrialSignupUseCases): Router {
  const requestLimit = createRateLimit({ windowMs: 900_000, limit: 10 });
  const perEmail = createRateLimit({ windowMs: 3_600_000, limit: 3, keyOf: emailOf });
  const sessionLimit = createRateLimit({ windowMs: 900_000, limit: 60 });
  resets.add(() => { requestLimit.reset(); sessionLimit.reset(); perEmail.reset(); });
  const router = Router();
  router.post("/", requestLimit, perEmail, handle(async (req, res) => {
    await useCases.request(trialSignupSchema.parse(req.body));
    res.status(202).send();
  }));
  router.get("/:token", sessionLimit, handle(async (req, res) => {
    await useCases.check(String(req.params.token));
    res.status(204).send();
  }));
  router.post("/:token/confirm", requestLimit, handle(async (req, res) => {
    const tokens = await useCases.confirm(String(req.params.token));
    setAuthCookies(res, tokens);
    res.json(tokens);
  }));
  return router;
}
