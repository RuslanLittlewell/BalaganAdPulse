import type { NextFunction, Request, Response } from "express";
import { createClientSchema, updateClientSchema } from "./client.schema.js";
import {
  createClient, listClients, getClient, updateClient, deleteClient,
} from "./client.service.js";

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createClientSchema.parse(req.body);
    res.status(201).json(await createClient(data));
  } catch (e) { next(e); }
}

export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listClients());
  } catch (e) { next(e); }
}

export async function getOne(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    res.json(await getClient(req.params.id));
  } catch (e) { next(e); }
}

export async function update(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const data = updateClientSchema.parse(req.body);
    res.json(await updateClient(req.params.id, data));
  } catch (e) { next(e); }
}

export async function remove(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    await deleteClient(req.params.id);
    res.status(204).send();
  } catch (e) { next(e); }
}
