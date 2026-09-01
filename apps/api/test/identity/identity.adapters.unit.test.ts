import { describe, expect, it, vi } from "vitest";
import { PasswordAdapter } from "../../src/modules/identity/infrastructure/password-adapter.js";
import { ProfileStorageAdapter } from "../../src/modules/identity/infrastructure/profile-storage-adapter.js";
import { TokenAdapter } from "../../src/modules/identity/infrastructure/token-adapter.js";

describe("identity crypto and token adapters", () => {
  it("hashes and verifies passwords without exposing the plain value", async () => {
    const adapter = new PasswordAdapter();
    const hash = await adapter.hash("correct horse");
    expect(hash).not.toContain("correct horse");
    await expect(adapter.verify("correct horse", hash)).resolves.toBe(true);
    await expect(adapter.verify("wrong horse", hash)).resolves.toBe(false);
  });

  it("issues JWT access tokens and opaque 30-day refresh tokens", async () => {
    const adapter = new TokenAdapter();
    const principal = { id: "u1", name: "Buyer", email: "buyer@acme.com" };
    expect(await adapter.verifyAccess(await adapter.issueAccess(principal))).toEqual(principal);
    const refresh = adapter.generateRefresh();
    expect(refresh).toMatch(/^[0-9a-f]{64}$/);
    expect(adapter.hashRefresh(refresh)).not.toBe(refresh);
    expect(adapter.refreshExpiry(new Date("2026-08-31T00:00:00.000Z")).toISOString()).toBe("2026-09-30T00:00:00.000Z");
  });
});

describe("identity profile storage adapter", () => {
  it("uses an identity-owned key and returns a PNG data URL", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const get = vi.fn().mockResolvedValue(Uint8Array.from([1, 2, 3]));
    const adapter = new ProfileStorageAdapter({ putPng: put, getPng: get });
    await adapter.writeAvatar("u1", Uint8Array.from([4, 5]));
    expect(put).toHaveBeenCalledWith("users/u1/avatar.png", expect.any(Uint8Array));
    await expect(adapter.readAvatar("u1")).resolves.toBe("data:image/png;base64,AQID");
  });

  it("treats unavailable avatar bytes as no picture", async () => {
    const adapter = new ProfileStorageAdapter({ putPng: vi.fn(), getPng: vi.fn().mockRejectedValue(new Error("missing")) });
    await expect(adapter.readAvatar("u1")).resolves.toBeNull();
  });
});

describe("access token verification", () => {
  it("round-trips a principal through issue and verify", async () => {
    const adapter = new TokenAdapter();
    const principal = { id: "u1", name: "Buyer", email: "buyer@acme.com" };
    const token = await adapter.issueAccess(principal);
    await expect(adapter.verifyAccess(token)).resolves.toEqual(principal);
  });

  it("refuses a tampered token", async () => {
    const adapter = new TokenAdapter();
    const token = await adapter.issueAccess({ id: "u1", name: "Buyer", email: "buyer@acme.com" });
    await expect(adapter.verifyAccess(`${token}x`)).rejects.toThrow();
  });

  it("refuses a token that is not a token at all", async () => {
    const adapter = new TokenAdapter();
    await expect(adapter.verifyAccess("not-a-jwt")).rejects.toThrow();
  });
});
