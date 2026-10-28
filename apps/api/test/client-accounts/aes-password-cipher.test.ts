import { describe, expect, it } from "vitest";
import { AesPasswordCipher } from "../../src/modules/client-accounts/infrastructure/aes-password-cipher.js";
import { AesCredentialCipher } from "../../src/modules/integrations/infrastructure/credential-cipher.js";

const KEY = Buffer.alloc(32, 7).toString("base64");

describe("the issued password cipher", () => {
  it("opens what it sealed for the same account", () => {
    const cipher = new AesPasswordCipher(KEY);
    const sealed = cipher.seal("Secret234567", "user-1");
    expect(sealed).not.toContain("Secret234567");
    expect(cipher.open(sealed, "user-1")).toBe("Secret234567");
  });

  it("seals the same password differently each time", () => {
    const cipher = new AesPasswordCipher(KEY);
    expect(cipher.seal("Secret234567", "user-1")).not.toBe(cipher.seal("Secret234567", "user-1"));
  });

  it("refuses to open a copy sealed for another account", () => {
    const cipher = new AesPasswordCipher(KEY);
    const sealed = cipher.seal("Secret234567", "user-1");
    expect(() => cipher.open(sealed, "user-2")).toThrow(expect.objectContaining({ category: "unavailable" }));
  });

  it("cannot be confused with an advertising token bound to the same id", () => {
    const token = new AesCredentialCipher(KEY).encrypt("refresh-token", "same-id");
    expect(() => new AesPasswordCipher(KEY).open(token, "same-id")).toThrow(expect.objectContaining({ category: "unavailable" }));
  });

  it("is unavailable without a key", () => {
    expect(() => new AesPasswordCipher("").seal("Secret234567", "user-1"))
      .toThrow(expect.objectContaining({ category: "unavailable" }));
  });
});
