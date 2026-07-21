import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../../src/middleware/error-handler.js";

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("errorHandler", () => {
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
});
