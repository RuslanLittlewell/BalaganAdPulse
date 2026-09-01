import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "../../../../shared/domain/index.js";
import { avatarUpload } from "../../../../shared/presentation/avatar-upload.js";
import { assertAvatarPath, assertAvatarPng } from "../../../../shared/presentation/avatar.js";
import type { ClientUseCases } from "../../application/client-use-cases.js";
import { createClientSchema, updateClientSchema } from "./client-schemas.js";

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

function handle<TRequest extends Request>(
  action: (req: TRequest, res: Response) => Promise<void>,
) {
  return (req: TRequest, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

export function createClientRouter(useCases: ClientUseCases): Router {
  const router = Router();
  router.post("/", handle(async (req, res) => {
    res.status(201).json(await useCases.create(actorOf(req), createClientSchema.parse(req.body)));
  }));
  router.get("/", handle(async (req, res) => {
    res.json(await useCases.list(actorOf(req)));
  }));
  router.get("/:id", handle(async (req: Request<{ id: string }>, res) => {
    res.json(await useCases.read(actorOf(req), req.params.id));
  }));
  router.patch("/:id", handle(async (req: Request<{ id: string }>, res) => {
    const input = updateClientSchema.parse(req.body);
    res.json(await useCases.update(actorOf(req), req.params.id, input));
  }));
  router.delete("/:id", handle(async (req: Request<{ id: string }>, res) => {
    await useCases.delete(actorOf(req), req.params.id);
    res.status(204).send();
  }));
  router.put("/:id/avatar", avatarUpload.single("image"), handle(async (req: Request<{ id: string }>, res) => {
    if (!req.file) throw new AppError("validation", "Avatar PNG is required");
    const avatarPath = String(req.body.avatarPath ?? "");
    assertAvatarPng(req.file.buffer);
    assertAvatarPath(avatarPath);
    res.json(await useCases.savePicture(actorOf(req), req.params.id, req.file.buffer, avatarPath));
  }));
  return router;
}
