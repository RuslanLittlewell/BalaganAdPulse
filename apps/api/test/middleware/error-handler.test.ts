import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { NotFoundError } from "../../src/errors.js";

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("errorHandler", () => {
  // The handler logs every 5xx server-side; keep that out of the test output.
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
