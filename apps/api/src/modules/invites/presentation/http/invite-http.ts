import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "../../../../shared/domain/index.js";
import { INVALID_INVITE } from "../../application/invite-use-cases.js";
import { createRateLimit } from "../../../../shared/presentation/rate-limit.js";
import type { InviteUseCases } from "../../application/invite-use-cases.js";
import {
  createInviteSchema,
  listInvitesQuerySchema,
  resolveInviteParamsSchema,
} from "./invite-schemas.js";

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

function handle<TRequest extends Request>(
  action: (req: TRequest, res: Response) => Promise<void>,
) {
  return (req: TRequest, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

export function createInviteRouter(useCases: InviteUseCases): Router {
  const router = Router();
  router.post("/", handle(async (req, res) => {
    const input = createInviteSchema.parse(req.body);
    res.status(201).json(await useCases.create(actorOf(req), input));
  }));
  router.get("/", handle(async (req, res) => {
    const { registrationType } = listInvitesQuerySchema.parse(req.query);
    res.json(await useCases.list(actorOf(req), registrationType));
  }));
  router.delete("/:id", handle(async (req: Request<{ id: string }>, res) => {
    await useCases.revoke(actorOf(req), req.params.id);
    res.status(204).send();
  }));
  return router;
}

export function createRegistrationResolverRouter(useCases: InviteUseCases): Router {
  const router = Router();
  const limiter = createRateLimit({ windowMs: 60_000, limit: 30 });
  router.get("/:code", limiter, handle(async (req: Request<{ code: string }>, res) => {
    // A code of the wrong shape is refused exactly as an unknown one is, rather
    // than as a validation error. Answering 400 here would tell a prober which
    // codes could never exist, which is the distinction this endpoint exists to
    // withhold — unknown, revoked, used, expired and malformed all look alike.
    const params = resolveInviteParamsSchema.safeParse(req.params);
    if (!params.success) throw new AppError("not-found", INVALID_INVITE);
    res.json(await useCases.resolve(params.data.code));
  }));
  return router;
}
