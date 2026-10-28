import type { NextFunction, Request, Response } from "express";

export const BASE_POLICY = "frame-ancestors 'none'; object-src 'none'; base-uri 'self'";

export function protectiveHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Content-Security-Policy", BASE_POLICY);
  next();
}
