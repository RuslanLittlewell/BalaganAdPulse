import { describe, it, expect } from "vitest";
import { createClientSchema, updateClientSchema } from "../../src/modules/clients/presentation/http/client-schemas.js";

describe("createClientSchema", () => {
  it("accepts name only", () => {
    expect(createClientSchema.safeParse({ name: "Acme" }).success).toBe(true);
  });
  it("rejects an empty name", () => {
    expect(createClientSchema.safeParse({ name: "" }).success).toBe(false);
  });
  it("rejects an invalid email", () => {
    expect(createClientSchema.safeParse({ name: "Acme", email: "not-email" }).success).toBe(false);
  });
  it("accepts all valid fields", () => {
    const r = createClientSchema.safeParse({
      name: "Acme", email: "a@b.com",
    });
    expect(r.success).toBe(true);
  });
  it("accepts the contact-book fields", () => {
    const r = createClientSchema.safeParse({
      name: "Acme",
      fullName: "Иван Петров",
      organization: "ООО «Акме»",
      unp: "191234567",
      phone: "+375 29 123-45-67",
      telegram: "@acme",
      email: "a@b.com",
      website: "https://acme.by",
    });
    expect(r.success).toBe(true);
  });
  it("rejects a contact field that is not a string", () => {
    expect(createClientSchema.safeParse({ name: "Acme", unp: 191234567 }).success).toBe(false);
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
