import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { AppError } from "../../../../shared/domain/index.js";
import type { TaskUseCases } from "../../application/task-use-cases.js";
import type { TaskImageUseCases } from "../../application/task-image-use-cases.js";
import { createTaskSchema, moveTaskSchema, updateTaskSchema } from "./task-schemas.js";

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

function handle<TRequest extends Request>(
  action: (req: TRequest, res: Response) => Promise<void>,
) {
  return (req: TRequest, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

export function createTaskRouter(useCases: TaskUseCases): Router {
  const router = Router();

  router.get("/", handle(async (req, res) => {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    res.json(await useCases.list(actorOf(req), projectId));
  }));
  router.post("/", handle(async (req, res) => {
    res.status(201).json(await useCases.create(actorOf(req), createTaskSchema.parse(req.body)));
  }));
  router.get("/:id", handle(async (req: Request<{ id: string }>, res) => {
    res.json(await useCases.read(actorOf(req), req.params.id));
  }));
  router.patch("/:id", handle(async (req: Request<{ id: string }>, res) => {
    res.json(await useCases.update(actorOf(req), req.params.id, updateTaskSchema.parse(req.body)));
  }));
  router.delete("/:id", handle(async (req: Request<{ id: string }>, res) => {
    await useCases.delete(actorOf(req), req.params.id);
    res.status(204).send();
  }));
  /** Where a drag lands: the target column and the position within it. */
  router.post("/:id/move", handle(async (req: Request<{ id: string }>, res) => {
    res.json(await useCases.move(actorOf(req), req.params.id, moveTaskSchema.parse(req.body)));
  }));

  return router;
}

/**
 * Task images. The read requires the same authentication as every other `/api`
 * route: the editor fetches with the member's token and renders from an object
 * URL, so an address opened without credentials serves nothing.
 */
export function createTaskImageRouter(
  useCases: TaskImageUseCases,
  upload: RequestHandler,
): Router {
  const router = Router();

  router.post("/", upload, handle(async (req, res) => {
    if (!req.file) throw new AppError("validation", "An image file is required");
    res.status(201).json(await useCases.upload(actorOf(req), req.file.buffer));
  }));

  router.get("/:id", handle(async (req: Request<{ id: string }>, res) => {
    const image = await useCases.read(actorOf(req), req.params.id);
    res.setHeader("Content-Type", image.contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(Buffer.from(image.body));
  }));

  return router;
}
