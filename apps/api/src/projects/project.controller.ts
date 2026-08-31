import type { NextFunction, Request, Response } from "express";
import { createProjectSchema, updateProjectSchema } from "./project.schema.js";
import * as service from "./project.service.js";
import { userId } from "../auth/current-user.js";
import { ValidationError } from "../errors.js";

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createProjectSchema.parse(req.body);
    res.status(201).json(await service.createProject(userId(req), data));
  } catch (e) { next(e); }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const clientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
    res.json(await service.listProjects(userId(req), clientId));
  } catch (e) { next(e); }
}

export async function getOne(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    res.json(await service.readProject(userId(req), req.params.id));
  } catch (e) { next(e); }
}

export async function update(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const data = updateProjectSchema.parse(req.body);
    res.json(await service.updateProject(userId(req), req.params.id, data));
  } catch (e) { next(e); }
}

export async function remove(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    await service.deleteProject(userId(req), req.params.id);
    res.status(204).send();
  } catch (e) { next(e); }
}

export async function uploadAvatar(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new ValidationError("Avatar PNG is required");
    res.json(await service.saveProjectAvatar(
      userId(req), req.params.id, req.file.buffer, String(req.body.avatarPath ?? ""),
    ));
  } catch (e) { next(e); }
}
