import type { NextFunction, Request, Response } from "express";
import { createRecordSchema, updateRecordSchema } from "./record.schema.js";
import { createRecord, updateRecord, deleteRecord, serializeRecord } from "./record.service.js";

export async function create(
  req: Request<{ campaignId: string }>, res: Response, next: NextFunction,
) {
  try {
    const data = createRecordSchema.parse(req.body);
    res.status(201).json(serializeRecord(await createRecord(req.params.campaignId, data)));
  } catch (e) { next(e); }
}

export async function update(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const data = updateRecordSchema.parse(req.body);
    res.json(serializeRecord(await updateRecord(req.params.id, data)));
  } catch (e) { next(e); }
}

export async function remove(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    await deleteRecord(req.params.id);
    res.status(204).send();
  } catch (e) { next(e); }
}
