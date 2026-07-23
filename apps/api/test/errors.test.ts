import { describe, it, expect } from "vitest";
import { ConflictError, NotFoundError, ValidationError } from "../src/errors.js";

describe("domain errors", () => {
  it("NotFoundError carries status 404", () => {
    expect(new NotFoundError("Campaign not found").status).toBe(404);
  });
  it("ValidationError carries status 400", () => {
    const error = new ValidationError("Formula creates a circular reference");
    expect(error.status).toBe(400);
    expect(error.message).toBe("Formula creates a circular reference");
  });
  it("ConflictError carries status 409", () => {
    expect(new ConflictError("Date already used").status).toBe(409);
  });
});
