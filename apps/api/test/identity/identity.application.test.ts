import { describe, expect, it } from "vitest";
import { AppError } from "../../src/shared/domain/app-error.js";
import type { TransactionContext } from "../../src/shared/application/unit-of-work.js";
import {
  createIdentityUseCases,
  type IdentityDependencies,
  type IdentityUser,
} from "../../src/modules/identity/index.js";

function fixture() {
  const users = new Map<string, IdentityUser>();
  const sessions = new Map<string, { userId: string; expiresAt: Date }>();
  const redeemed: string[] = [];
  const context = {} as TransactionContext;
  const dependencies: IdentityDependencies = {
    users: {
      findByEmail: async (email) => [...users.values()].find((user) => user.email === email) ?? null,
      findById: async (id) => users.get(id) ?? null,
      create: async (_tx, input) => {
        if ([...users.values()].some((user) => user.email === input.email)) throw new AppError("conflict", "This email is already registered");
        const user = { id: `u${users.size + 1}`, ...input, image: null, avatarPath: null };
        users.set(user.id, user);
        return user;
      },
      update: async (_tx, id, input) => {
        const user = users.get(id)!;
        const updated = { ...user, ...input };
        users.set(id, updated);
        return updated;
      },
      setAvatar: async (_tx, id, input) => {
        const user = users.get(id)!;
        users.set(id, { ...user, ...input });
      },
    },
    invitations: { redeem: async (_tx, code) => { redeemed.push(code); } },
    passwords: {
      hash: async (plain) => `hash:${plain}`,
      verify: async (plain, hash) => hash === `hash:${plain}`,
      dummyHash: "hash:not-the-password",
    },
    tokens: {
      issueAccess: async (principal) => `access:${principal.id}:${principal.name}`,
      verifyAccess: async (token) => {
        const [prefix, id] = token.split(":");
        const user = prefix === "access" ? users.get(id) : undefined;
        if (!user) throw new Error("not a valid access token");
        return { id: user.id, name: user.name, email: user.email };
      },
      generateRefresh: () => `refresh-${sessions.size + 1}`,
      hashRefresh: (token) => `digest:${token}`,
      refreshExpiry: (now) => new Date(now.getTime() + 1_000),
    },
    sessions: {
      save: async (_tx, value) => { sessions.set(value.tokenHash, { userId: value.userId, expiresAt: value.expiresAt }); },
      find: async (tokenHash) => {
        const value = sessions.get(tokenHash);
        if (!value) return null;
        return { ...value, user: users.get(value.userId)! };
      },
      revoke: async (_tx, tokenHash) => { sessions.delete(tokenHash); },
    },
    profiles: {
      readAvatar: async () => null,
      writeAvatar: async () => undefined,
    },
    clock: { now: () => new Date("2026-08-31T12:00:00.000Z") },
    unitOfWork: { run: (work) => work(context) },
  };
  return { users, sessions, redeemed, useCases: createIdentityUseCases(dependencies) };
}

describe("identity application use cases", () => {
  it("registers, redeems the invitation and issues a token pair atomically", async () => {
    const { users, redeemed, useCases } = fixture();
    const result = await useCases.register({ name: "Buyer", email: "buyer@acme.com", password: "secret123", inviteCode: "invite-1" });
    expect(result).toEqual({ accessToken: "access:u1:Buyer", refreshToken: "refresh-1" });
    expect(users.get("u1")?.passwordHash).toBe("hash:secret123");
    expect(redeemed).toEqual(["invite-1"]);
  });

  it("logs in without revealing whether email or password was wrong", async () => {
    const { useCases } = fixture();
    await expect(useCases.login({ email: "missing@acme.com", password: "wrong" }))
      .rejects.toMatchObject({ category: "unauthorized", message: "Invalid email or password" });
  });

  it("refreshes a live session and rejects an expired one", async () => {
    const { sessions, useCases } = fixture();
    const registered = await useCases.register({ name: "Buyer", email: "buyer@acme.com", password: "secret123", inviteCode: "invite-1" });
    await expect(useCases.refresh(registered.refreshToken)).resolves.toEqual({ accessToken: "access:u1:Buyer" });
    sessions.get(`digest:${registered.refreshToken}`)!.expiresAt = new Date(0);
    await expect(useCases.refresh(registered.refreshToken)).rejects.toMatchObject({ category: "unauthorized", message: "Session expired" });
  });

  it("revokes refresh sessions idempotently", async () => {
    const { sessions, useCases } = fixture();
    await useCases.logout("unknown");
    expect(sessions.size).toBe(0);
  });

  it("reads and updates a profile while requiring the current password", async () => {
    const { useCases } = fixture();
    await useCases.register({ name: "Buyer", email: "buyer@acme.com", password: "secret123", inviteCode: "invite-1" });
    expect(await useCases.profile("u1")).toMatchObject({ name: "Buyer", email: "buyer@acme.com", image: null });
    await expect(useCases.updateProfile("u1", { name: "New", currentPassword: "wrong", newPassword: "changed123" }))
      .rejects.toMatchObject({ category: "forbidden", message: "Current password is incorrect" });
    await expect(useCases.updateProfile("u1", { name: "New", currentPassword: "secret123", newPassword: "changed123" }))
      .resolves.toEqual({ accessToken: "access:u1:New" });
  });
});

describe("authenticate", () => {
  it("resolves the principal a valid access token stands for", async () => {
    const { useCases } = fixture();
    const registered = await useCases.register({
      name: "Buyer", email: "buyer@acme.com", password: "secret123", inviteCode: "invite-1",
    });
    await expect(useCases.authenticate(registered.accessToken)).resolves.toEqual({
      id: "u1", name: "Buyer", email: "buyer@acme.com",
    });
  });

  it("refuses a token the port rejects, without saying why", async () => {
    const { useCases } = fixture();
    await expect(useCases.authenticate("nonsense")).rejects.toMatchObject({
      category: "unauthorized",
      message: "Authentication required",
    });
  });
});
