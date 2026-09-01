import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { createRateLimit } from "../../src/shared/presentation/rate-limit.js";

function mockRequest(ip = "1.2.3.4"): Request {
  return { ip } as Request;
}

interface Captured {
  res: Response;
  statusCode?: number;
  body?: unknown;
  headers: Record<string, string>;
}

function mockResponse(): Captured {
  const captured: Captured = { headers: {} } as Captured;
  const res = {
    status(code: number) { captured.statusCode = code; return this; },
    json(payload: unknown) { captured.body = payload; return this; },
    setHeader(name: string, value: string) { captured.headers[name] = value; },
  } as unknown as Response;
  captured.res = res;
  return captured;
}

function call(limiter: ReturnType<typeof createRateLimit>, ip: string) {
  const captured = mockResponse();
  const next = vi.fn() as unknown as NextFunction;
  limiter(mockRequest(ip), captured.res, next);
  return { captured, next: next as unknown as ReturnType<typeof vi.fn> };
}

describe("createRateLimit", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("lets requests through up to the limit", () => {
    const limiter = createRateLimit({ windowMs: 1000, limit: 3 });
    for (let i = 0; i < 3; i++) expect(call(limiter, "1.1.1.1").next).toHaveBeenCalled();
    limiter.stop();
  });

  it("answers 429 past the limit", () => {
    const limiter = createRateLimit({ windowMs: 1000, limit: 2 });
    call(limiter, "1.1.1.1");
    call(limiter, "1.1.1.1");
    const { captured, next } = call(limiter, "1.1.1.1");
    expect(next).not.toHaveBeenCalled();
    expect(captured.statusCode).toBe(429);
    expect(captured.body).toEqual({
      error: { message: "Too many requests, try again later" },
    });
    limiter.stop();
  });

  it("sets Retry-After to the seconds left in the window", () => {
    const limiter = createRateLimit({ windowMs: 10_000, limit: 1 });
    call(limiter, "1.1.1.1");
    vi.advanceTimersByTime(4000);
    const { captured } = call(limiter, "1.1.1.1");
    expect(captured.headers["Retry-After"]).toBe("6");
    limiter.stop();
  });

  it("counts each address separately", () => {
    const limiter = createRateLimit({ windowMs: 1000, limit: 1 });
    call(limiter, "1.1.1.1");
    expect(call(limiter, "2.2.2.2").next).toHaveBeenCalled();
    limiter.stop();
  });

  it("starts a fresh window once the old one expires", () => {
    const limiter = createRateLimit({ windowMs: 1000, limit: 1 });
    call(limiter, "1.1.1.1");
    expect(call(limiter, "1.1.1.1").captured.statusCode).toBe(429);
    vi.advanceTimersByTime(1001);
    expect(call(limiter, "1.1.1.1").next).toHaveBeenCalled();
    limiter.stop();
  });

  it("sweeps expired entries instead of growing forever", () => {
    const limiter = createRateLimit({ windowMs: 1000, limit: 5, sweepIntervalMs: 500 });
    for (let i = 0; i < 50; i++) call(limiter, `10.0.0.${i}`);
    expect(limiter.size()).toBe(50);
    vi.advanceTimersByTime(2000);
    expect(limiter.size()).toBe(0);
    limiter.stop();
  });

  it("evicts the entry expiring soonest rather than exceeding its key cap", () => {
    const limiter = createRateLimit({ windowMs: 60_000, limit: 5, maxKeys: 3 });
    call(limiter, "10.0.0.1");
    vi.advanceTimersByTime(10);
    call(limiter, "10.0.0.2");
    vi.advanceTimersByTime(10);
    call(limiter, "10.0.0.3");
    call(limiter, "10.0.0.4");
    expect(limiter.size()).toBe(3);
    // The newcomer was admitted, and the oldest window made room for it.
    expect(call(limiter, "10.0.0.4").next).toHaveBeenCalled();
    limiter.stop();
  });

  it("reset() clears every window", () => {
    const limiter = createRateLimit({ windowMs: 1000, limit: 1 });
    call(limiter, "1.1.1.1");
    limiter.reset();
    expect(call(limiter, "1.1.1.1").next).toHaveBeenCalled();
    limiter.stop();
  });
});
