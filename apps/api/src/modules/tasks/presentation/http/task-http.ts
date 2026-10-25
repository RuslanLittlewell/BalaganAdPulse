import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { AppError } from "#shared/domain/index.js";
import type { TaskUseCases } from "#modules/tasks/application/task-use-cases.js";
import type { TaskCommentUseCases } from "#modules/tasks/application/task-comment-use-cases.js";
import type { TaskImageUseCases } from "#modules/tasks/application/task-image-use-cases.js";
import {
  addTaskCommentSchema, createTaskSchema, moveTaskSchema, taskFilterSchema, updateTaskSchema,
} from "./task-schemas.js";

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

function handle<TRequest extends Request>(
  action: (req: TRequest, res: Response) => Promise<void>,
) {
  return (req: TRequest, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

export function createTaskRouter(useCases: TaskUseCases, comments: TaskCommentUseCases): Router {
  const router = Router();

  router.get("/", handle(async (req, res) => {
    const only = (value: unknown) => (typeof value === "string" && value ? value : undefined);
    res.json(await useCases.list(actorOf(req), taskFilterSchema.parse({
      projectId: only(req.query.projectId),
      dueFrom: only(req.query.dueFrom),
      dueTo: only(req.query.dueTo),
    })));
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
  router.post("/:id/move", handle(async (req: Request<{ id: string }>, res) => {
    res.json(await useCases.move(actorOf(req), req.params.id, moveTaskSchema.parse(req.body)));
  }));
  router.post("/:id/complete", handle(async (req: Request<{ id: string }>, res) => {
    res.json(await useCases.complete(actorOf(req), req.params.id));
  }));

  router.get("/:id/comments", handle(async (req: Request<{ id: string }>, res) => {
    res.json(await comments.list(actorOf(req), req.params.id));
  }));
  router.post("/:id/comments", handle(async (req: Request<{ id: string }>, res) => {
    res.status(201).json(await comments.add(actorOf(req), req.params.id, addTaskCommentSchema.parse(req.body)));
  }));
  router.patch("/:id/comments/:commentId", handle(async (req: Request<{ id: string; commentId: string }>, res) => {
    res.json(await comments.edit(actorOf(req), req.params.id, req.params.commentId, addTaskCommentSchema.parse(req.body)));
  }));
  router.delete("/:id/comments/:commentId", handle(async (req: Request<{ id: string; commentId: string }>, res) => {
    await comments.remove(actorOf(req), req.params.id, req.params.commentId);
    res.status(204).send();
  }));

  return router;
}

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

  router.delete("/:id", handle(async (req: Request<{ id: string }>, res) => {
    await useCases.remove(actorOf(req), req.params.id);
    res.status(204).end();
  }));

  return router;
}
