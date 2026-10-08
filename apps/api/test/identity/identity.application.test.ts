import { describe, expect, it } from "vitest";
import { AppError } from "../../src/shared/domain/app-error.js";
import type { TransactionContext } from "../../src/shared/application/unit-of-work.js";
import {
  createIdentityUseCases,
  type IdentityDependencies,
  type IdentityUser,
} from "../../src/modules/identity/index.js";

function fixture(options: { mail?: boolean } = {}) {
  const users = new Map<string, IdentityUser>();
  const sessions = new Map<string, { userId: string; expiresAt: Date }>();
  const resets = new Map<string, { userId: string; tokenHash: string; expiresAt: Date }>();
  const delivered: { email: string; name: string; token: string }[] = [];
  let resetCount = 0;
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
      setPassword: async (_tx, id, passwordHash) => {
        const updated = { ...users.get(id)!, passwordHash };
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
      generateReset: () => `reset-${++resetCount}`,
      hashReset: (token) => `reset-digest:${token}`,
      resetExpiry: (now) => new Date(now.getTime() + 3_600_000),
    },
    sessions: {
      save: async (_tx, value) => { sessions.set(value.tokenHash, { userId: value.userId, expiresAt: value.expiresAt }); },
      find: async (tokenHash) => {
        const value = sessions.get(tokenHash);
        if (!value) return null;
        return { ...value, user: users.get(value.userId)! };
      },
      revoke: async (_tx, tokenHash) => { sessions.delete(tokenHash); },
      revokeAll: async (_tx, userId) => {
        for (const [hash, session] of sessions) if (session.userId === userId) sessions.delete(hash);
      },
    },
    resets: {
      replace: async (_tx, value) => { resets.set(value.userId, value); },
      find: async (tokenHash) => [...resets.values()].find((reset) => reset.tokenHash === tokenHash) ?? null,
      consume: async (_tx, tokenHash) => {
        const reset = [...resets.values()].find((candidate) => candidate.tokenHash === tokenHash);
        if (reset) resets.delete(reset.userId);
        return reset !== undefined;
      },
    },
    resetLinks: {
      available: options.mail ?? true,
      deliver: (recipient, token) => { delivered.push({ ...recipient, token }); },
    },
    profiles: {
      readAvatar: async () => null,
      writeAvatar: async () => undefined,
    },
    clock: { now: () => new Date("2026-08-31T12:00:00.000Z") },
    unitOfWork: { run: (work) => work(context) },
  };
  return { users, sessions, resets, delivered, redeemed, useCases: createIdentityUseCases(dependencies) };
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

describe("password recovery", () => {
  const registered = async (useCases: ReturnType<typeof fixture>["useCases"]) =>
    useCases.register({ name: "Buyer", email: "buyer@acme.com", password: "secret123", inviteCode: "invite-1" });

  it("mails a link to a registered email, keeping only its hash", async () => {
    const { resets, delivered, useCases } = fixture();
    await registered(useCases);

    await useCases.requestPasswordReset("buyer@acme.com");

    expect(delivered).toEqual([{ email: "buyer@acme.com", name: "Buyer", token: "reset-1" }]);
    expect(resets.get("u1")).toEqual({
      userId: "u1", tokenHash: "reset-digest:reset-1", expiresAt: new Date("2026-08-31T13:00:00.000Z"),
    });
  });

  it("answers an unknown email the same way and mails nothing", async () => {
    const { resets, delivered, useCases } = fixture();

    await expect(useCases.requestPasswordReset("nobody@acme.com")).resolves.toBeUndefined();

    expect(delivered).toEqual([]);
    expect(resets.size).toBe(0);
  });

  it("says recovery is unavailable when mail is not set up, whoever asks", async () => {
    const { delivered, useCases } = fixture({ mail: false });
    await registered(useCases);

    await expect(useCases.requestPasswordReset("buyer@acme.com"))
      .rejects.toMatchObject({ category: "unavailable" });
    await expect(useCases.requestPasswordReset("nobody@acme.com"))
      .rejects.toMatchObject({ category: "unavailable" });
    expect(delivered).toEqual([]);
  });

  it("lets only the newest link work", async () => {
    const { useCases } = fixture();
    await registered(useCases);
    await useCases.requestPasswordReset("buyer@acme.com");
    await useCases.requestPasswordReset("buyer@acme.com");

    await expect(useCases.checkPasswordReset("reset-1")).rejects.toMatchObject({ category: "not-found" });
    await expect(useCases.checkPasswordReset("reset-2")).resolves.toBeUndefined();
  });

  it("refuses a link once its hour is over", async () => {
    const { resets, useCases } = fixture();
    await registered(useCases);
    await useCases.requestPasswordReset("buyer@acme.com");
    resets.get("u1")!.expiresAt = new Date("2026-08-31T12:00:00.000Z");

    await expect(useCases.checkPasswordReset("reset-1")).rejects.toMatchObject({
      category: "not-found", message: "This password reset link is invalid or has expired",
    });
    await expect(useCases.resetPassword("reset-1", "changed123")).rejects.toMatchObject({ category: "not-found" });
  });

  it("sets the new password, ends every session and signs in, once", async () => {
    const { users, sessions, useCases } = fixture();
    await registered(useCases);
    await useCases.login({ email: "buyer@acme.com", password: "secret123" });
    expect(sessions.size).toBe(2);
    await useCases.requestPasswordReset("buyer@acme.com");

    const signedIn = await useCases.resetPassword("reset-1", "changed123");

    expect(users.get("u1")?.passwordHash).toBe("hash:changed123");
    expect([...sessions.keys()]).toEqual([`digest:${signedIn.refreshToken}`]);
    expect(signedIn.accessToken).toBe("access:u1:Buyer");
    await expect(useCases.resetPassword("reset-1", "another123")).rejects.toMatchObject({ category: "not-found" });
  });
});
