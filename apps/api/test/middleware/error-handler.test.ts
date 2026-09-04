import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../../src/shared/presentation/error-handler.js";
import { NotFoundError, ServiceUnavailableError } from "../../src/shared/presentation/http-errors.js";

function mockRes(): Response & { headers: Record<string, string>; body?: unknown } {
  const res = {} as Response & { headers: Record<string, string>; body?: unknown };
  res.statusCode = 200;
  res.headers = {} as Record<string, string>;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.setHeader = vi.fn((name: string, value: string) => {
    res.headers[name] = value;
    return res;
  });
  res.json = vi.fn((data: unknown) => {
    res.body = data;
    return res;
  });
  return res;
}

function mockRequest(): Request {
  return {} as Request;
}

describe("errorHandler", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  it("returns 500 and \"Internal error\" for a non-Error value", () => {
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    errorHandler("boom", {} as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: { message: "Internal error" } });
  });

  it("uses the numeric status from the error object", () => {
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    errorHandler({ status: 418 }, {} as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(418);
    expect(res.json).toHaveBeenCalledWith({ error: { message: "Internal error" } });
  });

  it("does not leak the message of an unexpected error", () => {
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    const leaky = new Error(
      "Invalid `prisma.client.findFirst()` invocation in /Users/someone/AdPulse/apps/api/src/x.ts:12",
    );

    errorHandler(leaky, {} as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: { message: "Internal error" } });
    expect(JSON.stringify(vi.mocked(res.json).mock.calls)).not.toContain("prisma");
  });

  it("logs the real error server-side", () => {
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    const boom = new Error("connection terminated unexpectedly");

    errorHandler(boom, {} as Request, res, next);

    expect(consoleError).toHaveBeenCalledWith(expect.any(String), boom);
  });

  it("keeps the message of a deliberate error below 500", () => {
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    errorHandler(new NotFoundError("Client not found"), {} as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: { message: "Client not found" } });
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe("errorHandler and deliberate 5xx errors", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  it("keeps the message of an error marked expose", () => {
    const res = mockRes();
    errorHandler(new ServiceUnavailableError("Server is busy"), mockRequest(), res, () => {});
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: { message: "Server is busy" } });
  });

  it("sets Retry-After when the error carries one", () => {
    const res = mockRes();
    errorHandler(new ServiceUnavailableError("Server is busy", 3), mockRequest(), res, () => {});
    expect(res.headers["Retry-After"]).toBe("3");
  });

  it("still hides the message of an unplanned 500", () => {
    const res = mockRes();
    errorHandler(new Error("Prisma leaked /Users/someone/secret.ts"), mockRequest(), res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: { message: "Internal error" } });
  });
});
