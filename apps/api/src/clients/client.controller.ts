import type { NextFunction, Request, Response } from "express";
import { createClientSchema, updateClientSchema } from "./client.schema.js";
import {
  createClient, listClients, readClient, updateClient, deleteClient, saveClientAvatar,
} from "./client.service.js";
import { userId } from "../auth/current-user.js";
import { ValidationError } from "../errors.js";

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createClientSchema.parse(req.body);
    res.status(201).json(await createClient(userId(req), data));
  } catch (e) { next(e); }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listClients(userId(req)));
  } catch (e) { next(e); }
}

export async function getOne(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    res.json(await readClient(userId(req), req.params.id));
  } catch (e) { next(e); }
}

export async function update(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const data = updateClientSchema.parse(req.body);
    res.json(await updateClient(userId(req), req.params.id, data));
  } catch (e) { next(e); }
}

export async function remove(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    await deleteClient(userId(req), req.params.id);
    res.status(204).send();
  } catch (e) { next(e); }
}

export async function uploadAvatar(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new ValidationError("Avatar PNG is required");
    const saved = await saveClientAvatar(
      userId(req), req.params.id, req.file.buffer, String(req.body.avatarPath ?? ""),
    );
    res.json(saved);
  } catch (e) { next(e); }
}
