import type { NextFunction, Request, Response } from "express";
import { setValueSchema } from "./value.schema.js";
import { setPropertyValue } from "./value.service.js";

export async function set(
  req: Request<{ recordId: string; propertyId: string }>, res: Response, next: NextFunction,
) {
  try {
    const { value } = setValueSchema.parse(req.body);
    res.json(await setPropertyValue(req.params.recordId, req.params.propertyId, value));
  } catch (e) { next(e); }
}
