import { describe, expect, it } from "vitest";
import { assertTestDatabase } from "../helpers/db.js";

describe("the database reset guard", () => {
  it.each([
    ["the development database", "postgresql://postgres:secret@localhost:5432/adpulse?schema=public"],
    ["a database with no schema", "postgresql://postgres:secret@localhost:5432/adpulse_test"],
    ["an empty address", ""],
  ])("refuses %s", (_, url) => {
    expect(() => assertTestDatabase(url)).toThrow(/Refusing to reset/);
  });

  it("allows a worker schema of a test run", () => {
    expect(() => assertTestDatabase("postgresql://postgres:secret@localhost:5432/adpulse_test?schema=test_run_abc_w1")).not.toThrow();
  });
});
