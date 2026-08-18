import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: { message: "Validation error", details: err.issues } });
    return;
  }
  const status = typeof (err as { status?: number }).status === "number"
    ? (err as { status: number }).status
    : 500;

  // Anything 500 and above was not planned for, so its message was never
  // written to be read by a stranger: Prisma's own errors, for one, carry the
  // absolute source path and a snippet of the failing call. Log it where the
  // operator can see it and answer with a fixed string.
  if (status >= 500) {
    console.error("Unhandled error while serving a request:", err);
    res.status(status).json({ error: { message: "Internal error" } });
    return;
  }

  // Below 500 the message is deliberate and human-facing — the frontend shows
  // it to the user unchanged.
  const message = err instanceof Error ? err.message : "Internal error";
  res.status(status).json({ error: { message } });
}
