import { describe, it, expect } from "vitest";
import { createClientSchema, updateClientSchema } from "../../src/clients/client.schema.js";

describe("createClientSchema", () => {
  it("accepts name only", () => {
    expect(createClientSchema.safeParse({ name: "Acme" }).success).toBe(true);
  });
  it("rejects an empty name", () => {
    expect(createClientSchema.safeParse({ name: "" }).success).toBe(false);
  });
  it("rejects a negative budget", () => {
    expect(createClientSchema.safeParse({ name: "Acme", monthlyBudget: -1 }).success).toBe(false);
  });
  it("rejects an invalid email", () => {
    expect(createClientSchema.safeParse({ name: "Acme", email: "not-email" }).success).toBe(false);
  });
  it("accepts all valid fields", () => {
    const r = createClientSchema.safeParse({
      name: "Acme", niche: "fitness", monthlyBudget: 500, email: "a@b.com",
    });
    expect(r.success).toBe(true);
  });
});

describe("updateClientSchema", () => {
  it("accepts an empty object", () => {
    expect(updateClientSchema.safeParse({}).success).toBe(true);
  });
  it("rejects an empty name when present", () => {
    expect(updateClientSchema.safeParse({ name: "" }).success).toBe(false);
  });
});
