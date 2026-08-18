import type { NextFunction, Request, Response } from "express";
import {
  loginSchema, logoutSchema, refreshSchema, registerSchema,
} from "./auth.schema.js";
import * as service from "./auth.service.js";

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body);
    res.status(201).json(await service.register(data));
  } catch (e) { next(e); }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const data = loginSchema.parse(req.body);
    res.json(await service.login(data));
  } catch (e) { next(e); }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const data = refreshSchema.parse(req.body);
    res.json(await service.refresh(data.refreshToken));
  } catch (e) { next(e); }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const data = logoutSchema.parse(req.body);
    await service.logout(data.refreshToken);
    res.status(204).send();
  } catch (e) { next(e); }
}
