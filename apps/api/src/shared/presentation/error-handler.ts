import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../domain/app-error.js";
import { appErrorToHttp } from "./app-error-to-http.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    const response = appErrorToHttp(err);
    res.status(response.status).json(response.body);
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: { message: "Validation error", details: err.issues } });
    return;
  }
  const status = typeof (err as { status?: number }).status === "number"
    ? (err as { status: number }).status
    : 500;

  const expose = (err as { expose?: boolean }).expose === true;
  const retryAfter = (err as { retryAfter?: number }).retryAfter;
  if (typeof retryAfter === "number") res.setHeader("Retry-After", String(retryAfter));

  if (status >= 500 && !expose) {
    console.error("Unhandled error while serving a request:", err);
    res.status(status).json({ error: { message: "Internal error" } });
    return;
  }

  const message = err instanceof Error ? err.message : "Internal error";
  res.status(status).json({ error: { message } });
}
