import express, { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "#shared/domain/index.js";
import type { ProjectDocumentUseCases } from "#modules/project-documents/application/project-document-use-cases.js";
import { createDocumentSchema, updateDocumentSchema } from "./project-document-schemas.js";

type Params = { projectId: string; id?: string };

export const projectDocumentBody = express.json({ limit: "2mb" });

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

function handle(action: (req: Request<Params>, res: Response) => Promise<void>) {
  return (req: Request<Params>, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

export function createProjectDocumentRouter(useCases: ProjectDocumentUseCases): Router {
  const router = Router({ mergeParams: true });
  router.get("/", handle(async (req, res) => {
    res.json(await useCases.list(actorOf(req), req.params.projectId));
  }));
  router.post("/", handle(async (req, res) => {
    res.status(201).json(await useCases.create(actorOf(req), req.params.projectId, createDocumentSchema.parse(req.body)));
  }));
  router.get("/:id", handle(async (req, res) => {
    res.json(await useCases.read(actorOf(req), req.params.projectId, req.params.id!));
  }));
  router.patch("/:id", handle(async (req, res) => {
    res.json(await useCases.update(actorOf(req), req.params.projectId, req.params.id!, updateDocumentSchema.parse(req.body)));
  }));
  router.delete("/:id", handle(async (req, res) => {
    await useCases.delete(actorOf(req), req.params.projectId, req.params.id!);
    res.status(204).send();
  }));
  return router;
}
