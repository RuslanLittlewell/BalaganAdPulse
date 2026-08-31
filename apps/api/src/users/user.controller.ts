import type { NextFunction, Request, Response } from "express";
import { userId } from "../auth/current-user.js";
import * as service from "./user.service.js";
import { updateProfileSchema } from "../auth/auth.schema.js";
import { ValidationError } from "../errors.js";

export async function uploadAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new ValidationError("Avatar PNG is required");
    await service.saveAvatar(userId(req), req.file.buffer, String(req.body.avatarPath ?? ""));
    res.status(204).send();
  } catch (error) { next(error); }
}

export async function profile(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.profile(userId(req))); } catch (error) { next(error); }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.updateProfile(userId(req), updateProfileSchema.parse(req.body)));
  } catch (error) { next(error); }
}
