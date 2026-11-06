import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "#shared/domain/index.js";
import type { OnboardingUseCases } from "#modules/onboarding/application/onboarding-use-cases.js";

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

function handle(action: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve().then(() => action(req, res)).catch(next);
  };
}

export function createOnboardingRouter(useCases: OnboardingUseCases): Router {
  const router = Router();
  router.get("/", handle(async (req, res) => {
    res.json(await useCases.describe(actorOf(req)));
  }));
  router.post("/welcome", handle(async (req, res) => {
    await useCases.welcome(actorOf(req));
    res.status(204).send();
  }));
  router.post("/hide", handle(async (req, res) => {
    await useCases.hide(actorOf(req));
    res.status(204).send();
  }));
  return router;
}
