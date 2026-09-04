import { describe, expect, it } from "vitest";
import type { ActorContext } from "../../src/shared/application/index.js";
import type { TransactionContext } from "../../src/shared/application/unit-of-work.js";
import { createMemberUseCases, type MemberRecord } from "../../src/modules/members/index.js";

const admin: ActorContext = { userId: "u-admin", membershipId: "m-admin", orgId: "org1", role: "ADMIN" };
const manager: ActorContext = { userId: "u-mgr", membershipId: "m-mgr", orgId: "org1", role: "MANAGER" };

function member(partial: Partial<MemberRecord> = {}): MemberRecord {
  return {
    id: "m1", userId: "u1", orgId: "org1", name: "Buyer", email: "buyer@acme.com",
    image: null, role: "MANAGER", status: "ACTIVE", createdAt: new Date("2026-09-01T00:00:00.000Z"),
    ...partial,
  };
}

function fixture(seed: MemberRecord[] = [], grantable: Record<string, string[]> = {}) {
  const context = {} as TransactionContext;
  const members = new Map(seed.map((value) => [value.id, value]));
  let grants: Array<{ membershipId: string; clientId: string; projectId: string | null }> = [];

  const useCases = createMemberUseCases({
    memberships: { findActiveByUserId: async () => null },
    organizations: { findById: async () => null },
    users: { findById: async () => null },
    clients: { reachableClientIds: async () => [] },
    directory: {
      listByOrg: async (orgId) =>
        [...members.values()].filter((value) => value.orgId === orgId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
      findInOrg: async (orgId, id) => {
        const value = members.get(id);
        return value && value.orgId === orgId ? value : null;
      },
      update: async (_tx, id, input) => {
        const updated = { ...members.get(id)!, ...input };
        members.set(id, updated);
        return updated;
      },
      remove: async (_tx, id) => { members.delete(id); },
      countOtherActiveAdmins: async (orgId, exceptId) =>
        [...members.values()].filter((value) =>
          value.orgId === orgId && value.id !== exceptId &&
          value.role === "ADMIN" && value.status === "ACTIVE").length,
    },
    access: {
      projectsByClient: async (orgId, clientIds) =>
        new Map(clientIds.filter((id) => id in grantable).map((id) => [id, grantable[id]])),
      replace: async (_tx, membershipId, next) => {
        grants = grants.filter((grant) => grant.membershipId !== membershipId);
        grants.push(...next.map((grant) => ({ membershipId, ...grant })));
      },
      listFor: async (membershipId) => grants.filter((grant) => grant.membershipId === membershipId),
    },
    unitOfWork: { run: (work) => work(context) },
  });
  return { useCases, members, grantsOf: () => grants };
}

describe("listing members", () => {
  it("returns the organization's members oldest first", async () => {
    const { useCases } = fixture([
      member({ id: "b", name: "Later", createdAt: new Date("2026-09-02T00:00:00.000Z") }),
      member({ id: "a", name: "Earlier", createdAt: new Date("2026-09-01T00:00:00.000Z") }),
    ]);
    expect((await useCases.list(admin)).map((m) => m.name)).toEqual(["Earlier", "Later"]);
  });

  it("refuses a role that may not read members", async () => {
    const { useCases } = fixture();
    await expect(useCases.list(manager)).rejects.toMatchObject({ category: "forbidden" });
  });
});

describe("updating a member", () => {
  it("changes the role", async () => {
    const { useCases, members } = fixture([member({ id: "m1" })]);
    await useCases.update(admin, "m1", { role: "GUEST" });
    expect(members.get("m1")!.role).toBe("GUEST");
  });

  it("suspends and reactivates", async () => {
    const { useCases, members } = fixture([member({ id: "m1" })]);
    await useCases.update(admin, "m1", { status: "SUSPENDED" });
    expect(members.get("m1")!.status).toBe("SUSPENDED");
    await useCases.update(admin, "m1", { status: "ACTIVE" });
    expect(members.get("m1")!.status).toBe("ACTIVE");
  });

  it("answers not-found for a membership of another organization", async () => {
    const { useCases } = fixture([member({ id: "m1", orgId: "other" })]);
    await expect(useCases.update(admin, "m1", { role: "GUEST" }))
      .rejects.toMatchObject({ category: "not-found" });
  });

  it("refuses a role that may not manage members", async () => {
    const { useCases } = fixture([member({ id: "m1" })]);
    await expect(useCases.update(manager, "m1", { role: "GUEST" }))
      .rejects.toMatchObject({ category: "forbidden" });
  });

  describe("the last active admin", () => {
    const onlyAdmin = () => fixture([member({ id: "m1", role: "ADMIN", status: "ACTIVE" })]);

    it("cannot be demoted", async () => {
      const { useCases, members } = onlyAdmin();
      await expect(useCases.update(admin, "m1", { role: "MANAGER" }))
        .rejects.toMatchObject({ category: "conflict" });
      expect(members.get("m1")!.role).toBe("ADMIN");
    });

    it("cannot be suspended", async () => {
      const { useCases, members } = onlyAdmin();
      await expect(useCases.update(admin, "m1", { status: "SUSPENDED" }))
        .rejects.toMatchObject({ category: "conflict" });
      expect(members.get("m1")!.status).toBe("ACTIVE");
    });

    it("cannot be removed", async () => {
      const { useCases, members } = onlyAdmin();
      await expect(useCases.remove(admin, "m1")).rejects.toMatchObject({ category: "conflict" });
      expect(members.has("m1")).toBe(true);
    });

    it("may be demoted once a second active admin exists", async () => {
      const { useCases } = fixture([
        member({ id: "m1", role: "ADMIN" }),
        member({ id: "m2", role: "ADMIN" }),
      ]);
      await expect(useCases.update(admin, "m1", { role: "MANAGER" })).resolves.toBeDefined();
    });

    it("is not protected by a suspended second admin", async () => {
      const { useCases } = fixture([
        member({ id: "m1", role: "ADMIN" }),
        member({ id: "m2", role: "ADMIN", status: "SUSPENDED" }),
      ]);
      await expect(useCases.update(admin, "m1", { role: "MANAGER" }))
        .rejects.toMatchObject({ category: "conflict" });
    });
  });
});

describe("removing a member", () => {
  it("removes the membership", async () => {
    const { useCases, members } = fixture([member({ id: "m1" })]);
    await useCases.remove(admin, "m1");
    expect(members.has("m1")).toBe(false);
  });

  it("refuses a role that may not remove members", async () => {
    const { useCases } = fixture([member({ id: "m1" })]);
    await expect(useCases.remove(manager, "m1")).rejects.toMatchObject({ category: "forbidden" });
  });

  it("refuses an admin removing their own membership", async () => {
    const { useCases, members } = fixture([
      member({ id: admin.membershipId, role: "ADMIN" }),
      member({ id: "other-admin", role: "ADMIN" }),
    ]);

    await expect(useCases.remove(admin, admin.membershipId))
      .rejects.toMatchObject({ category: "conflict" });
    expect(members.has(admin.membershipId)).toBe(true);
  });

  it("still removes a different member", async () => {
    const { useCases, members } = fixture([
      member({ id: admin.membershipId, role: "ADMIN" }),
      member({ id: "m1" }),
    ]);

    await useCases.remove(admin, "m1");

    expect(members.has("m1")).toBe(false);
    expect(members.has(admin.membershipId)).toBe(true);
  });
});

describe("replacing a member's access", () => {
  it("stores the whole set the admin asked for", async () => {
    const { useCases, grantsOf } = fixture([member({ id: "m1" })], { c1: ["p1"], c2: [] });
    await useCases.setAccess(admin, "m1", { grants: [{ clientId: "c1" }, { clientId: "c2" }] });
    expect(grantsOf()).toEqual([
      { membershipId: "m1", clientId: "c1", projectId: null },
      { membershipId: "m1", clientId: "c2", projectId: null },
    ]);
  });

  it("replaces rather than adds", async () => {
    const { useCases, grantsOf } = fixture([member({ id: "m1" })], { c1: [], c2: [] });
    await useCases.setAccess(admin, "m1", { grants: [{ clientId: "c1" }] });
    await useCases.setAccess(admin, "m1", { grants: [{ clientId: "c2" }] });
    expect(grantsOf().map((grant) => grant.clientId)).toEqual(["c2"]);
  });

  it("withdraws everything when given an empty set", async () => {
    const { useCases, grantsOf } = fixture([member({ id: "m1" })], { c1: [] });
    await useCases.setAccess(admin, "m1", { grants: [{ clientId: "c1" }] });
    await useCases.setAccess(admin, "m1", { grants: [] });
    expect(grantsOf()).toEqual([]);
  });

  it("narrows a grant to one project of a client", async () => {
    const { useCases, grantsOf } = fixture([member({ id: "m1" })], { c1: ["p1", "p2"] });
    await useCases.setAccess(admin, "m1", { grants: [{ clientId: "c1", projectId: "p1" }] });
    expect(grantsOf()).toEqual([{ membershipId: "m1", clientId: "c1", projectId: "p1" }]);
  });

  it("refuses a client outside the organization, and writes nothing", async () => {
    const { useCases, grantsOf } = fixture([member({ id: "m1" })], { c1: [] });
    await expect(useCases.setAccess(admin, "m1", { grants: [{ clientId: "elsewhere" }] }))
      .rejects.toMatchObject({ category: "validation" });
    expect(grantsOf()).toEqual([]);
  });

  it("refuses a project that belongs to another client", async () => {
    const { useCases } = fixture([member({ id: "m1" })], { c1: ["p1"], c2: ["p2"] });
    await expect(useCases.setAccess(admin, "m1", { grants: [{ clientId: "c2", projectId: "p1" }] }))
      .rejects.toMatchObject({ category: "validation" });
  });

  it("refuses the same grant twice", async () => {
    const { useCases } = fixture([member({ id: "m1" })], { c1: [] });
    await expect(useCases.setAccess(admin, "m1", { grants: [{ clientId: "c1" }, { clientId: "c1" }] }))
      .rejects.toMatchObject({ category: "validation" });
  });

  it("answers not-found for a membership of another organization", async () => {
    const { useCases } = fixture([member({ id: "m1", orgId: "other" })], { c1: [] });
    await expect(useCases.setAccess(admin, "m1", { grants: [] }))
      .rejects.toMatchObject({ category: "not-found" });
  });

  it("refuses a role that may not manage access", async () => {
    const { useCases } = fixture([member({ id: "m1" })], { c1: [] });
    await expect(useCases.setAccess(manager, "m1", { grants: [{ clientId: "c1" }] }))
      .rejects.toMatchObject({ category: "forbidden" });
  });
});
