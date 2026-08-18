import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import {
  register, login, refresh, logout, DUMMY_PASSWORD_HASH,
} from "../../src/auth/auth.service.js";
import { hashRefreshToken, verifyAccessToken } from "../../src/auth/token.js";
import { config } from "../../src/config.js";

const input = {
  name: "Buyer", email: "buyer@acme.com", password: "hunter2hunter2",
  inviteCode: config.inviteCode,
};

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("DUMMY_PASSWORD_HASH", () => {
  it("is a well-formed salt:key pair, so verifyPassword actually runs scrypt on it", () => {
    expect(DUMMY_PASSWORD_HASH).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });
});

describe("register", () => {
  it("creates the user and returns both tokens", async () => {
    const pair = await register(input);
    expect(pair.accessToken).toMatch(/\./);
    expect(pair.refreshToken).toMatch(/^[0-9a-f]{64}$/);
    expect(await prisma.user.count()).toBe(1);
    const user = await prisma.user.findFirstOrThrow();
    const claims = await verifyAccessToken(pair.accessToken);
    expect(claims.sub).toBe(user.id);
  });

  it("never stores the password itself", async () => {
    await register(input);
    const user = await prisma.user.findFirstOrThrow();
    expect(user.passwordHash).not.toContain("hunter2hunter2");
  });

  it("stores the refresh token hashed", async () => {
    const pair = await register(input);
    const row = await prisma.refreshToken.findFirstOrThrow();
    expect(row.tokenHash).toBe(hashRefreshToken(pair.refreshToken));
    expect(row.tokenHash).not.toBe(pair.refreshToken);
  });

  it("rejects a wrong invite code with 403", async () => {
    await expect(register({ ...input, inviteCode: "nope" }))
      .rejects.toMatchObject({ status: 403 });
  });

  it("rejects a duplicate email with 409", async () => {
    await register(input);
    await expect(register(input)).rejects.toMatchObject({ status: 409 });
  });
});

describe("login", () => {
  it("returns a fresh pair for the right password", async () => {
    await register(input);
    const pair = await login({ email: input.email, password: input.password });
    expect(pair.refreshToken).toMatch(/^[0-9a-f]{64}$/);
    expect(await prisma.refreshToken.count()).toBe(2);
  });

  it("rejects a wrong password with 401", async () => {
    await register(input);
    await expect(login({ email: input.email, password: "wrongwrongwrong" }))
      .rejects.toMatchObject({ status: 401, message: "Invalid email or password" });
  });

  it("gives an unknown email the identical answer", async () => {
    await expect(login({ email: "nobody@acme.com", password: "hunter2hunter2" }))
      .rejects.toMatchObject({ status: 401, message: "Invalid email or password" });
  });

  it("deletes the user's expired refresh rows", async () => {
    const { refreshToken } = await register(input);
    const user = await prisma.user.findFirstOrThrow();
    await prisma.refreshToken.create({
      data: {
        userId: user.id, tokenHash: "stale-hash",
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    await login({ email: input.email, password: input.password });
    const hashes = (await prisma.refreshToken.findMany()).map((row) => row.tokenHash);
    expect(hashes).not.toContain("stale-hash");
    expect(hashes).toContain(hashRefreshToken(refreshToken));
  });
});

describe("refresh", () => {
  it("issues a new access token and leaves the refresh token in place", async () => {
    const pair = await register(input);
    const { accessToken } = await refresh(pair.refreshToken);
    expect(accessToken).toMatch(/\./);
    const user = await prisma.user.findFirstOrThrow();
    const claims = await verifyAccessToken(accessToken);
    expect(claims.sub).toBe(user.id);
    expect(await prisma.refreshToken.count()).toBe(1);
  });

  it("accepts the same refresh token twice — tokens are not rotated", async () => {
    const pair = await register(input);
    await refresh(pair.refreshToken);
    await expect(refresh(pair.refreshToken)).resolves.toHaveProperty("accessToken");
  });

  it("rejects an unknown token with 401", async () => {
    await expect(refresh("f".repeat(64))).rejects.toMatchObject({ status: 401 });
  });

  it("rejects an expired token with 401", async () => {
    const pair = await register(input);
    await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(refresh(pair.refreshToken)).rejects.toMatchObject({ status: 401 });
  });
});

describe("logout", () => {
  it("deletes the row so the token stops working", async () => {
    const pair = await register(input);
    await logout(pair.refreshToken);
    expect(await prisma.refreshToken.count()).toBe(0);
    await expect(refresh(pair.refreshToken)).rejects.toMatchObject({ status: 401 });
  });

  it("is silent about a token that is already gone", async () => {
    await expect(logout("f".repeat(64))).resolves.toBeUndefined();
  });
});
