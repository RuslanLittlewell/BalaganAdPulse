import { describe, expect, it } from "vitest";
import type { ActorContext } from "../../src/shared/application/index.js";
import { FixedClock } from "../../src/shared/infrastructure/clock.js";
import { DeterministicIdGenerator } from "../../src/shared/infrastructure/id-generator.js";
import type { TransactionContext } from "../../src/shared/application/unit-of-work.js";
import { createInviteUseCases, type Invite } from "../../src/modules/invites/index.js";

const NOW = new Date("2026-09-01T12:00:00.000Z");
const admin: ActorContext = { userId: "u-admin", membershipId: "m-admin", orgId: "org1", role: "ADMIN" };
const manager: ActorContext = { ...admin, userId: "u-mgr", membershipId: "m-mgr", role: "MANAGER" };

function fixture(seed: readonly Partial<Invite>[] = []) {
  const context = {} as TransactionContext;
  const invites = new Map<string, Invite>();
  const enrolled: Array<{ userId: string; orgId: string; role: string }> = [];
  let created = 0;

  for (const [index, partial] of seed.entries()) {
    const invite: Invite = {
      id: `i${index}`, orgId: "org1", code: `code${index}`, role: "MANAGER", email: null,
      expiresAt: null, revokedAt: null, usedAt: null, usedById: null,
      createdById: "m-admin", createdAt: new Date(NOW.getTime() - index * 1000),
      ...partial,
    };
    invites.set(invite.id, invite);
  }

  const useCases = createInviteUseCases({
    invites: {
      create: async (_tx, input) => {
        const invite: Invite = {
          usedAt: null, usedById: null, revokedAt: null, createdAt: NOW, ...input,
        };
        invites.set(invite.id, invite);
        created += 1;
        return invite;
      },
      listByOrg: async (orgId) =>
        [...invites.values()].filter((invite) => invite.orgId === orgId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      findInOrg: async (orgId, id) => {
        const invite = invites.get(id);
        return invite && invite.orgId === orgId ? invite : null;
      },
      findByCode: async (_tx, code) =>
        [...invites.values()].find((invite) => invite.code === code) ?? null,
      revoke: async (_tx, id, at) => { invites.set(id, { ...invites.get(id)!, revokedAt: at }); },
      claim: async (_tx, id, userId, at) => {
        const invite = invites.get(id)!;
        if (invite.usedAt) return false;
        invites.set(id, { ...invite, usedAt: at, usedById: userId });
        return true;
      },
    },
    memberships: { enrol: async (_tx, value) => { enrolled.push(value); } },
    clock: new FixedClock(NOW),
    ids: new DeterministicIdGenerator(["id-1", "id-2", "id-3", "code-1", "code-2", "code-3"]),
    unitOfWork: { run: (work) => work(context) },
  });
  return { useCases, invites, enrolled, context, createdCount: () => created };
}

describe("creating an invitation", () => {
  it("stores the role it was asked for, pending and unclaimed", async () => {
    const { useCases } = fixture();
    const invite = await useCases.create(admin, { role: "GUEST" });
    expect(invite).toMatchObject({
      orgId: "org1", role: "GUEST", email: null, expiresAt: null,
      usedAt: null, revokedAt: null, status: "PENDING", createdById: "m-admin",
    });
  });

  it("takes its id and code from the generator, so both are deterministic under test", async () => {
    const { useCases } = fixture();
    const invite = await useCases.create(admin, { role: "MANAGER" });
    expect(invite.id).toBe("id-1");
    expect(invite.code).toBe("id-2");
  });

  it("turns a day count into an expiry measured from the clock", async () => {
    const { useCases } = fixture();
    const invite = await useCases.create(admin, { role: "MANAGER", expiresInDays: 7 });
    expect(invite.expiresAt?.toISOString()).toBe("2026-09-08T12:00:00.000Z");
  });

  it("refuses a role that may not invite", async () => {
    const { useCases, createdCount } = fixture();
    await expect(useCases.create(manager, { role: "GUEST" }))
      .rejects.toMatchObject({ category: "forbidden" });
    expect(createdCount()).toBe(0);
  });
});

describe("listing invitations", () => {
  it("returns the organization's invitations newest first, with their status", async () => {
    const { useCases } = fixture([
      { id: "a", code: "older", createdAt: new Date(NOW.getTime() - 5000) },
      { id: "b", code: "newer", createdAt: NOW, usedAt: NOW },
    ]);
    const listed = await useCases.list(admin);
    expect(listed.map((invite) => invite.code)).toEqual(["newer", "older"]);
    expect(listed.map((invite) => invite.status)).toEqual(["USED", "PENDING"]);
  });

  it("reports an expiry that has passed as expired", async () => {
    const { useCases } = fixture([{ id: "a", expiresAt: new Date(NOW.getTime() - 1) }]);
    expect((await useCases.list(admin))[0].status).toBe("EXPIRED");
  });

  it("refuses a role that may not read invitations", async () => {
    const { useCases } = fixture();
    await expect(useCases.list(manager)).rejects.toMatchObject({ category: "forbidden" });
  });
});

describe("revoking an invitation", () => {
  it("stamps it revoked at the current moment", async () => {
    const { useCases, invites } = fixture([{ id: "a" }]);
    await useCases.revoke(admin, "a");
    expect(invites.get("a")!.revokedAt).toEqual(NOW);
  });

  it("refuses to rewrite the history of one already redeemed", async () => {
    const { useCases, invites } = fixture([{ id: "a", usedAt: NOW, usedById: "u9" }]);
    await expect(useCases.revoke(admin, "a")).rejects.toMatchObject({ category: "conflict" });
    expect(invites.get("a")!.revokedAt).toBeNull();
  });

  it("answers not-found for an invitation of another organization", async () => {
    const { useCases } = fixture([{ id: "a", orgId: "other" }]);
    await expect(useCases.revoke(admin, "a")).rejects.toMatchObject({ category: "not-found" });
  });

  it("refuses a role that may not revoke", async () => {
    const { useCases } = fixture([{ id: "a" }]);
    await expect(useCases.revoke(manager, "a")).rejects.toMatchObject({ category: "forbidden" });
  });
});

describe("redeeming an invitation", () => {
  const redeem = (useCases: ReturnType<typeof fixture>["useCases"], context: TransactionContext, code: string, email = "new@acme.com") =>
    useCases.redeem(context, code, email, "u-new", NOW);

  it("enrols the new member with the role the invitation names", async () => {
    const { useCases, context, enrolled } = fixture([{ id: "a", code: "good", role: "GUEST" }]);
    await redeem(useCases, context, "good");
    expect(enrolled).toEqual([{ userId: "u-new", orgId: "org1", role: "GUEST" }]);
  });

  it("claims the invitation for the person who used it", async () => {
    const { useCases, context, invites } = fixture([{ id: "a", code: "good" }]);
    await redeem(useCases, context, "good");
    expect(invites.get("a")).toMatchObject({ usedAt: NOW, usedById: "u-new" });
  });

  it.each([
    ["unknown", { id: "a", code: "other" }, "missing"],
    ["already redeemed", { id: "a", code: "good", usedAt: NOW }, "good"],
    ["revoked", { id: "a", code: "good", revokedAt: NOW }, "good"],
    ["expired", { id: "a", code: "good", expiresAt: new Date(NOW.getTime() - 1) }, "good"],
  ])("refuses an %s invitation, without enrolling anyone", async (_label, seed, code) => {
    const { useCases, context, enrolled } = fixture([seed]);
    await expect(redeem(useCases, context, code)).rejects.toMatchObject({ category: "forbidden" });
    expect(enrolled).toEqual([]);
  });

  it("refuses an address-bound invitation used from another address", async () => {
    const { useCases, context, enrolled } = fixture([{ id: "a", code: "good", email: "invited@acme.com" }]);
    await expect(redeem(useCases, context, "good", "someone.else@acme.com"))
      .rejects.toMatchObject({ category: "forbidden" });
    expect(enrolled).toEqual([]);
  });

  it("accepts an address-bound invitation from the address it names", async () => {
    const { useCases, context, enrolled } = fixture([{ id: "a", code: "good", email: "invited@acme.com" }]);
    await redeem(useCases, context, "good", "invited@acme.com");
    expect(enrolled).toHaveLength(1);
  });

  it("refuses when the claim loses a race, so a code is never spent twice", async () => {
    const { useCases, context } = fixture([{ id: "a", code: "good" }]);
    // Simulate the loser of a race: the read passed, the conditional claim did not.
    await redeem(useCases, context, "good");
    await expect(redeem(useCases, context, "good")).rejects.toMatchObject({ category: "forbidden" });
  });
});
