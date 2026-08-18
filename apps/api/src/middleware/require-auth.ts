import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../errors.js";
import { verifyAccessToken } from "../auth/token.js";

const PREFIX = "Bearer ";

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header("authorization");
  if (!header?.startsWith(PREFIX)) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }
  try {
    const claims = await verifyAccessToken(header.slice(PREFIX.length));
    req.user = { id: claims.sub };
    next();
  } catch {
    // Expired, tampered and malformed all look the same from outside.
    next(new UnauthorizedError("Authentication required"));
  }
}
