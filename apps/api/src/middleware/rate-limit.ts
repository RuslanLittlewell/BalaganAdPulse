import type { NextFunction, Request, RequestHandler, Response } from "express";

export interface RateLimitOptions {
  windowMs: number;
  limit: number;
  /** Ceiling on tracked addresses. See the comment on `admit`. */
  maxKeys?: number;
  sweepIntervalMs?: number;
}

export interface RateLimiter extends RequestHandler {
  /** Number of tracked addresses. Exposed so the bound can be asserted. */
  size(): number;
  /** Drops every window. Tests share one module-level limiter across cases. */
  reset(): void;
  /** Clears the sweep interval. */
  stop(): void;
}

interface Window {
  count: number;
  resetAt: number;
}

const DEFAULT_MAX_KEYS = 10_000;
const DEFAULT_SWEEP_INTERVAL_MS = 60_000;

/** A fixed window per client address, held in memory.
 *
 * In memory is not a compromise here: the service runs as a single process, so
 * there is no second instance whose counters would need to agree with these.
 *
 * The store is bounded twice over. A periodic sweep drops windows that have
 * expired, and a hard key cap covers the case the sweep cannot — a burst from
 * many forged addresses arriving faster than the sweep interval. Without both,
 * the defence against a flood would itself be a way to exhaust a 512 MB
 * process's memory. */
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

  /** Makes room for a new address when the cap is reached: sweep first, and if
   * everything tracked is still live, drop the window closest to expiring.
   *
   * Evicting rather than refusing is deliberate. Refusing new keys would let an
   * attacker fill the table and lock every genuine user out; admitting without
   * a bound would let them exhaust memory. The evicted window is the one
   * nearest natural expiry anyway, so this is not targeted at anyone —
   * whichever address it belongs to, legitimate or not, simply gets a fresh
   * window a little early. Clearing a counter early can only ever grant a
   * fresher window, never lock someone out. */
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
  // Unreferenced so a pending sweep can never hold the process open while it
  // drains on SIGTERM.
  timer.unref();

  const middleware = (req: Request, res: Response, next: NextFunction): void => {
    // `req.ip` is only trustworthy because app.ts sets `trust proxy` to 1.
    // With `true`, a client could prepend a forged X-Forwarded-For entry and
    // get a fresh window for every request.
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
