import { z } from "zod";
import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "../../../../shared/domain/index.js";
import type { MemberUseCases } from "../../application/member-use-cases.js";
import { MEMBER_KINDS } from "../../application/ports.js";
import { setAccessSchema, updateMemberSchema } from "./member-schemas.js";

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

function handle<TRequest extends Request>(
  action: (req: TRequest, res: Response) => Promise<void>,
) {
  return (req: TRequest, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

const memberQuerySchema = z.object({
  kind: z.enum(MEMBER_KINDS).optional(),
  clientId: z.uuid().optional(),
});

export function createMemberRouter(useCases: MemberUseCases): Router {
  const router = Router();
  router.get("/", handle(async (req, res) => {
    const { kind, clientId } = memberQuerySchema.parse(req.query);
    res.json(clientId
      ? await useCases.listOfClient(actorOf(req), clientId)
      : await useCases.list(actorOf(req), kind));
  }));
  router.get("/:id/avatar", handle(async (req: Request<{ id: string }>, res) => {
    const png = await useCases.avatar(actorOf(req), req.params.id);
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "private, max-age=300");
    res.send(Buffer.from(png));
  }));
  router.patch("/:id", handle(async (req: Request<{ id: string }>, res) => {
    const change = updateMemberSchema.parse(req.body);
    res.json(await useCases.update(actorOf(req), req.params.id, change));
  }));
  router.get("/:id/access", handle(async (req: Request<{ id: string }>, res) => {
    res.json(await useCases.accessOf(actorOf(req), req.params.id));
  }));
  router.put("/:id/access", handle(async (req: Request<{ id: string }>, res) => {
    const input = setAccessSchema.parse(req.body);
    res.json(await useCases.setAccess(actorOf(req), req.params.id, input));
  }));
  router.delete("/:id", handle(async (req: Request<{ id: string }>, res) => {
    await useCases.remove(actorOf(req), req.params.id);
    res.status(204).send();
  }));
  return router;
}
