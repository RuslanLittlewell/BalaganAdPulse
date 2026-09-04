import type { NextFunction, Request, RequestHandler, Response } from "express";

export interface RateLimitOptions {
  windowMs: number;
  limit: number;
  maxKeys?: number;
  sweepIntervalMs?: number;
}

export interface RateLimiter extends RequestHandler {
  size(): number;
  reset(): void;
  stop(): void;
}

interface Window {
  count: number;
  resetAt: number;
}

const DEFAULT_MAX_KEYS = 10_000;
const DEFAULT_SWEEP_INTERVAL_MS = 60_000;

export function createRateLimit(options: RateLimitOptions): RateLimiter {
  const {
    windowMs,
    limit,
    maxKeys = DEFAULT_MAX_KEYS,
    sweepIntervalMs = DEFAULT_SWEEP_INTERVAL_MS,
  } = options;

  const windows = new Map<string, Window>();

  function sweep(now = Date.now()): void {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
  }

  function admit(now: number): void {
    if (windows.size < maxKeys) return;
    sweep(now);
    if (windows.size < maxKeys) return;
    let oldestKey: string | undefined;
    let oldestResetAt = Infinity;
    for (const [key, window] of windows) {
      if (window.resetAt < oldestResetAt) {
        oldestResetAt = window.resetAt;
        oldestKey = key;
      }
    }
    if (oldestKey !== undefined) windows.delete(oldestKey);
  }

  const timer = setInterval(() => sweep(), sweepIntervalMs);
  timer.unref();

  const middleware = (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? "unknown";
    const now = Date.now();

    let window = windows.get(key);
    if (!window || window.resetAt <= now) {
      admit(now);
      window = { count: 0, resetAt: now + windowMs };
      windows.set(key, window);
    }

    window.count += 1;
    if (window.count > limit) {
      res.setHeader("Retry-After", String(Math.ceil((window.resetAt - now) / 1000)));
      res.status(429).json({ error: { message: "Too many requests, try again later" } });
      return;
    }

    next();
  };

  return Object.assign(middleware, {
    size: () => windows.size,
    reset: () => windows.clear(),
    stop: () => clearInterval(timer),
  }) as RateLimiter;
}
