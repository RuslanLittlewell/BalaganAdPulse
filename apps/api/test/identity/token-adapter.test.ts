import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { TokenAdapter } from "../../src/modules/identity/infrastructure/token-adapter.js";
import { config } from "../../src/shared/infrastructure/config.js";

const adapter = new TokenAdapter();
const principal = { id: "user-1", name: "Buyer", email: "buyer@acme.com" };

function signWithClaims(payload: Record<string, string>, subject?: string): Promise<string> {
  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m");
  if (subject !== undefined) jwt.setSubject(subject);
  return jwt.sign(new TextEncoder().encode(config.jwtSecret));
}

describe("access tokens", () => {
  it("round-trips its claims", async () => {
    const token = await adapter.issueAccess(principal);
    expect(await adapter.verifyAccess(token)).toEqual(principal);
  });

  it("expires 15 minutes after it is issued", async () => {
    const token = await adapter.issueAccess(principal);
    const [, payload] = token.split(".");
    const { iat, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(Math.abs(exp - iat - 900)).toBeLessThanOrEqual(1);
  });

  it("rejects a tampered token", async () => {
    const token = await adapter.issueAccess(principal);
    await expect(adapter.verifyAccess(`${token}x`)).rejects.toThrow();
  });

  it("rejects a token that is not a token at all", async () => {
    await expect(adapter.verifyAccess("nonsense")).rejects.toThrow();
  });

  it("rejects a validly signed token with no sub claim", async () => {
    const token = await signWithClaims({ name: principal.name, email: principal.email });
    await expect(adapter.verifyAccess(token)).rejects.toThrow();
  });

  it("rejects a validly signed token with no name claim", async () => {
    const token = await signWithClaims({ email: principal.email }, principal.id);
    await expect(adapter.verifyAccess(token)).rejects.toThrow();
  });

  it("rejects a validly signed token with no email claim", async () => {
    const token = await signWithClaims({ name: principal.name }, principal.id);
    await expect(adapter.verifyAccess(token)).rejects.toThrow();
  });
});

describe("refresh tokens", () => {
  it("generates 32 bytes of hex", () => {
    expect(adapter.generateRefresh()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates a different token each time", () => {
    expect(adapter.generateRefresh()).not.toBe(adapter.generateRefresh());
  });

  it("hashes deterministically and does not return the token itself", () => {
    const token = adapter.generateRefresh();
    expect(adapter.hashRefresh(token)).toBe(adapter.hashRefresh(token));
    expect(adapter.hashRefresh(token)).not.toBe(token);
  });

  it("expires 30 days after the given moment", () => {
    const now = new Date("2026-08-13T00:00:00.000Z");
    expect(adapter.refreshExpiry(now).toISOString()).toBe("2026-09-12T00:00:00.000Z");
  });
});
