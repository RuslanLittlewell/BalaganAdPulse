import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../../src/auth/password.js";

describe("password hashing", () => {
  it("produces a different hash for the same password each time", async () => {
    const first = await hashPassword("correct horse");
    const second = await hashPassword("correct horse");
    expect(first).not.toBe(second);
  });

  it("stores the salt and the key separated by a colon", async () => {
    const stored = await hashPassword("correct horse");
    const [salt, key] = stored.split(":");
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(key).toMatch(/^[0-9a-f]{128}$/);
  });

  it("accepts the right password", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", stored)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("wrong horse", stored)).toBe(false);
  });

  it("rejects a malformed stored value instead of throwing", async () => {
    expect(await verifyPassword("correct horse", "not-a-hash")).toBe(false);
  });
});
