import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "../../src/auth/auth.schema.js";

describe("registerSchema", () => {
  const valid = {
    name: "Buyer", email: "Buyer@Acme.com", password: "hunter2hunter2", inviteCode: "c",
  };

  it("lowercases and trims the email", () => {
    expect(registerSchema.parse({ ...valid, email: "  Buyer@Acme.com " }).email)
      .toBe("buyer@acme.com");
  });

  it("trims the name", () => {
    expect(registerSchema.parse({ ...valid, name: "  Buyer  " }).name).toBe("Buyer");
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(() => registerSchema.parse({ ...valid, password: "short" })).toThrow();
  });

  it("rejects an address without a dotted domain", () => {
    expect(() => registerSchema.parse({ ...valid, email: "buyer@acme" })).toThrow();
  });

  it("rejects a missing invite code", () => {
    expect(() => registerSchema.parse({ ...valid, inviteCode: "" })).toThrow();
  });
});

describe("loginSchema", () => {
  it("lowercases the email", () => {
    expect(loginSchema.parse({ email: "Buyer@Acme.com", password: "x" }).email)
      .toBe("buyer@acme.com");
  });
});
