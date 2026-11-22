import type { NextFunction, Request, RequestHandler, Response } from "express";

const AD_PREVIEW_FRAMES = "https://www.facebook.com https://*.facebook.com";

function socketOrigin(appUrl: string | null): string {
  if (!appUrl) return "";
  const { protocol, host } = new URL(appUrl);
  return ` ${protocol === "https:" ? "wss:" : "ws:"}//${host}`;
}

export function contentSecurityPolicy(appUrl: string | null, scriptSources = ""): string {
  return [
    "default-src 'self'",
    `script-src 'self'${scriptSources}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    `connect-src 'self'${socketOrigin(appUrl)}`,
    `frame-src ${AD_PREVIEW_FRAMES}`,
    "worker-src 'self' blob:",
    "form-action 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function createProtectiveHeaders(appUrl: string | null): RequestHandler {
  const policy = contentSecurityPolicy(appUrl);
  return function protectiveHeaders(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Content-Security-Policy", policy);
    next();
  };
}
