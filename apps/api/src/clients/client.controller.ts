import type { NextFunction, Request, Response } from "express";
import { createClientSchema, updateClientSchema } from "./client.schema.js";
import {
  createClient, listClients, getClient, updateClient, deleteClient,
} from "./client.service.js";
import { userId } from "../auth/current-user.js";

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
    res.json(await getClient(userId(req), req.params.id));
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
