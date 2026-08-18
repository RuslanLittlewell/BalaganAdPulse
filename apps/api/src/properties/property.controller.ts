import type { NextFunction, Request, Response } from "express";
import { createPropertySchema, updatePropertySchema } from "./property.schema.js";
import { createProperty, updateProperty, deleteProperty } from "./property.service.js";
import { userId } from "../auth/current-user.js";

export async function create(
  req: Request<{ campaignId: string }>, res: Response, next: NextFunction,
) {
  try {
    const data = createPropertySchema.parse(req.body);
    res.status(201).json(await createProperty(userId(req), req.params.campaignId, data));
  } catch (e) { next(e); }
}

export async function update(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const data = updatePropertySchema.parse(req.body);
    res.json(await updateProperty(userId(req), req.params.id, data));
  } catch (e) { next(e); }
}

export async function remove(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    await deleteProperty(userId(req), req.params.id);
    res.status(204).send();
  } catch (e) { next(e); }
}
