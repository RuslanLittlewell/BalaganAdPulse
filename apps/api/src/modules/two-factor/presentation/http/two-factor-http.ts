import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { AppError } from "#shared/domain/index.js";
import { createRateLimit } from "#shared/presentation/rate-limit.js";
import { setAuthCookies } from "#modules/identity/index.js";
import type { TwoFactorUseCases } from "#modules/two-factor/application/two-factor-use-cases.js";
import { challengeSchema, codeSchema, platformResetSchema, requirementSchema } from "./two-factor-schemas.js";

function handle<TRequest extends Request>(action: (req: TRequest, res: Response) => Promise<void>) {
  return (req: TRequest, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

function principalOf(req: Request) {
  if (!req.principal) throw new AppError("unauthorized", "Authentication required");
  return req.principal;
}

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

const addressOf = (req: Request) => req.ip ?? "unknown";

const resets = new Set<() => void>();
export function resetTwoFactorRateLimits(): void { resets.forEach((reset) => reset()); }

export function createTwoFactorRouter(twoFactor: TwoFactorUseCases): Router {
  const codeLimit = createRateLimit({ windowMs: 900_000, limit: 20 });
  resets.add(() => codeLimit.reset());
  const router = Router();
  router.get("/", handle(async (req, res) => { res.json(await twoFactor.status(principalOf(req))); }));
  router.post("/setup", handle(async (req, res) => { res.json(await twoFactor.startSetup(principalOf(req))); }));
  router.post("/confirm", codeLimit, handle(async (req, res) => {
    res.json(await twoFactor.confirmSetup(principalOf(req), codeSchema.parse(req.body).code, addressOf(req)));
  }));
  router.post("/disable", codeLimit, handle(async (req, res) => {
    await twoFactor.disable(principalOf(req), codeSchema.parse(req.body).code);
    res.status(204).send();
  }));
  router.post("/backup-codes", codeLimit, handle(async (req, res) => {
    res.json(await twoFactor.renewBackupCodes(principalOf(req), codeSchema.parse(req.body).code));
  }));
  router.get("/addresses", handle(async (req, res) => { res.json(await twoFactor.addresses(principalOf(req))); }));
  router.delete("/addresses", handle(async (req, res) => {
    await twoFactor.forgetAll(principalOf(req));
    res.status(204).send();
  }));
  router.delete("/addresses/:id", handle(async (req: Request<{ id: string }>, res) => {
    await twoFactor.forget(principalOf(req), req.params.id);
    res.status(204).send();
  }));
  return router;
}

export function createTwoFactorSignInRouter(twoFactor: TwoFactorUseCases): Router {
  const signInLimit = createRateLimit({ windowMs: 900_000, limit: 10 });
  resets.add(() => signInLimit.reset());
  const router = Router();
  router.post("/", signInLimit, handle(async (req, res) => {
    const { challenge, code } = challengeSchema.parse(req.body);
    const tokens = await twoFactor.complete(challenge, code, addressOf(req));
    setAuthCookies(res, tokens);
    res.json(tokens);
  }));
  return router;
}

export function createOrganizationTwoFactorRouter(twoFactor: TwoFactorUseCases): Router {
  const router = Router();
  router.get("/", handle(async (req, res) => { res.json(await twoFactor.organization(actorOf(req))); }));
  router.put("/", handle(async (req, res) => {
    res.json(await twoFactor.setRequirement(actorOf(req), requirementSchema.parse(req.body).required));
  }));
  router.post("/members/:membershipId/reset", handle(async (req: Request<{ membershipId: string }>, res) => {
    await twoFactor.resetMember(actorOf(req), req.params.membershipId);
    res.status(204).send();
  }));
  return router;
}

export function createPlatformTwoFactorRouter(twoFactor: TwoFactorUseCases): Router {
  const router = Router();
  router.post("/reset", handle(async (req, res) => {
    await twoFactor.resetByEmail(principalOf(req).id, platformResetSchema.parse(req.body).email);
    res.status(204).send();
  }));
  return router;
}

export function createTwoFactorGate(twoFactor: TwoFactorUseCases): RequestHandler {
  return function gateTwoFactor(req: Request, _res: Response, next: NextFunction): void {
    if (!req.actor) {
      next();
      return;
    }
    twoFactor.assertEnrolledIfRequired(req.actor).then(() => next(), next);
  };
}
