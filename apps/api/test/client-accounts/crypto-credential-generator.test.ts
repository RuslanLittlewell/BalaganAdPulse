import { describe, expect, it } from "vitest";
import {
  CryptoCredentialGenerator,
  PASSWORD_ALPHABET,
} from "../../src/modules/client-accounts/infrastructure/crypto-credential-generator.js";

describe("the credential generator", () => {
  const generator = new CryptoCredentialGenerator();

  it("draws four digits for a login", () => {
    expect(generator.loginDigits()).toMatch(/^\d{4}$/);
  });

  it("draws twelve characters a person can read without confusing them", () => {
    const password = generator.password();
    expect(password).toHaveLength(12);
    expect([...password].every((character) => PASSWORD_ALPHABET.includes(character))).toBe(true);
    expect(PASSWORD_ALPHABET).not.toMatch(/[0O1lIo]/);
  });

  it("draws a different password each time", () => {
    expect(new Set(Array.from({ length: 20 }, () => generator.password())).size).toBe(20);
  });
});
