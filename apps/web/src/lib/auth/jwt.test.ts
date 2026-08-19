import { describe, it, expect } from "vitest";
import { decodeAccessToken, isExpired } from "./jwt.js";

function encode(value: object): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function token(payload: object): string {
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

const valid = { sub: "u1", name: "Buyer", email: "buyer@acme.com", exp: 1_800_000_000 };

describe("decodeAccessToken", () => {
  it("reads the claims out of the payload", () => {
    expect(decodeAccessToken(token(valid))).toEqual(valid);
  });

  it("reads a payload whose base64url needs padding", () => {
    const payload = { ...valid, name: "Buyerrr" };
    expect(decodeAccessToken(token(payload))).toEqual(payload);
  });

  it("returns null for something that is not a token", () => {
    expect(decodeAccessToken("nonsense")).toBeNull();
  });

  it("returns null for a payload that is not JSON", () => {
    expect(decodeAccessToken("a.!!!.c")).toBeNull();
  });

  it("returns null when a claim is missing", () => {
    expect(decodeAccessToken(token({ sub: "u1", exp: 1 }))).toBeNull();
  });
});

describe("isExpired", () => {
  const now = 1_000_000_000_000;

  it("is false well before the expiry", () => {
    expect(isExpired({ ...valid, exp: now / 1000 + 600 }, now)).toBe(false);
  });

  it("is true after the expiry", () => {
    expect(isExpired({ ...valid, exp: now / 1000 - 1 }, now)).toBe(true);
  });

  it("is true inside the 30-second margin", () => {
    expect(isExpired({ ...valid, exp: now / 1000 + 10 }, now)).toBe(true);
  });
});
