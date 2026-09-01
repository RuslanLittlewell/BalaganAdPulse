import { describe, expect, it } from "vitest";
import { AppError } from "../../src/shared/domain/app-error.js";
import { appErrorToHttp } from "../../src/shared/presentation/app-error-to-http.js";

describe("AppError", () => {
  it.each([
    ["validation", 400],
    ["unauthorized", 401],
    ["forbidden", 403],
    ["not-found", 404],
    ["conflict", 409],
  ] as const)("maps %s without transport state in the domain error", (category, status) => {
    const error = new AppError(category, "Deliberate message", { field: "name" });
    expect(error).not.toHaveProperty("status");
    expect(appErrorToHttp(error)).toEqual({ status, body: { error: { message: "Deliberate message", details: { field: "name" } } } });
  });
});
