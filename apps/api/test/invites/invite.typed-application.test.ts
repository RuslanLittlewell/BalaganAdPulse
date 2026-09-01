import { describe, expect, it } from "vitest";
import type { ActorContext, TransactionContext } from "../../src/shared/application/index.js";
import { FixedClock } from "../../src/shared/infrastructure/clock.js";
import {
  CryptoInvitationCodeGenerator,
  INVITATION_CODE_ALPHABET,
  InvitationCodeConflictError,
  createInviteUseCases,
  type Invite,
} from "../../src/modules/invites/index.js";

const NOW = new Date("2026-09-01T12:00:00.000Z");
const admin: ActorContext = { userId: "u-admin", membershipId: "m-admin", orgId: "org-1", role: "ADMIN" };
const manager: ActorContext = { ...admin, userId: "u-manager", membershipId: "m-manager", role: "MANAGER" };

function fixture(options: {
  codes?: string[];
  seed?: Invite[];
  ownedProjectIds?: string[];
  failGrant?: boolean;
} = {}) {
  const transaction = {} as TransactionContext;
  const invites = new Map((options.seed ?? []).map((invite) => [invite.id, invite]));
  const memberships: string[] = [];
  const grants: Array<{ membershipId: string; projectIds: readonly string[] }> = [];
  const codes = [...(options.codes ?? ["ABCDEFGH"])];
  let id = 0;

  const unitOfWork = {
    run: async <T>(work: (context: TransactionContext) => Promise<T>) => {
      const inviteSnapshot = new Map(invites);
      const membershipCount = memberships.length;
      const grantCount = grants.length;
      try {
        return await work(transaction);
      } catch (error) {
        invites.clear();
        inviteSnapshot.forEach((value, key) => invites.set(key, value));
        memberships.length = membershipCount;
        grants.length = grantCount;
        throw error;
      }
    },
  };

  const dependencies = {
    invites: {
      create: async (_context: TransactionContext, input: Omit<Invite, "createdAt" | "usedAt" | "usedById" | "revokedAt">) => {
        if ([...invites.values()].some((invite) => invite.code === input.code)) {
          throw new InvitationCodeConflictError();
        }
        const invite: Invite = {
          ...input,
          createdAt: NOW,
          usedAt: null,
          usedById: null,
          revokedAt: null,
        };
        invites.set(invite.id, invite);
        return invite;
      },
      listByOrg: async () => [...invites.values()],
      listPendingByOrg: async (orgId: string, _now: Date, registrationType?: string) =>
        [...invites.values()].filter((invite) =>
          invite.orgId === orgId && (!registrationType || invite.registrationType === registrationType)),
      findInOrg: async (orgId: string, inviteId: string) => {
        const invite = invites.get(inviteId);
        return invite?.orgId === orgId ? invite : null;
      },
      findByCode: async (_context: TransactionContext, code: string) =>
        [...invites.values()].find((invite) => invite.code === code) ?? null,
      revoke: async () => undefined,
      claim: async (_context: TransactionContext, inviteId: string, userId: string, at: Date) => {
        const invite = invites.get(inviteId);
        if (!invite || invite.usedAt) return false;
        invites.set(inviteId, { ...invite, usedAt: at, usedById: userId });
        return true;
      },
    },
    memberships: {
      enrol: async (_context: TransactionContext) => {
        memberships.push("membership-new");
        return "membership-new";
      },
    },
    projectAccess: {
      grant: async (_context: TransactionContext, membershipId: string, projectIds: readonly string[]) => {
        if (options.failGrant) throw new Error("grant failed");
        grants.push({ membershipId, projectIds });
      },
    },
    projects: {
      allBelongToOrg: async (_orgId: string, projectIds: readonly string[]) =>
        projectIds.every((projectId) => (options.ownedProjectIds ?? ["project-1"]).includes(projectId)),
    },
    codes: { generate: () => codes.shift() ?? "ZZZZZZZZ" },
    clock: new FixedClock(NOW),
    ids: { generate: () => `invite-${++id}` },
    unitOfWork,
  };

  return {
    useCases: createInviteUseCases(dependencies as never),
    transaction,
    invites,
    memberships,
    grants,
    unitOfWork,
  };
}

function employeeInvite(overrides: Partial<Invite> = {}): Invite {
  return {
    id: "invite-existing",
    orgId: "org-1",
    code: "EXISTING",
    registrationType: "EMPLOYEE",
    role: "MANAGER",
    projectIds: ["project-1"],
    email: null,
    expiresAt: null,
    revokedAt: null,
    usedAt: null,
    usedById: null,
    createdById: "m-admin",
    createdAt: NOW,
    ...overrides,
  };
}

describe("typed invitation creation", () => {
  it("generates exactly eight URL-safe unambiguous characters", () => {
    const code = new CryptoInvitationCodeGenerator().generate();
    expect(code).toHaveLength(8);
    expect([...code].every((character) => INVITATION_CODE_ALPHABET.includes(character))).toBe(true);
  });

  it("creates a client invitation without employee-only fields", async () => {
    const { useCases } = fixture();
    const invite = await useCases.create(admin, { registrationType: "CLIENT" } as never);
    expect(invite).toMatchObject({
      registrationType: "CLIENT",
      role: null,
      projectIds: [],
      code: "ABCDEFGH",
      registrationUrl: "/regustration/ABCDEFGH",
    });
  });

  it("rejects employee fields on a client invitation", async () => {
    const { useCases, invites } = fixture();
    await expect(useCases.create(admin, {
      registrationType: "CLIENT", role: "GUEST", projectIds: ["project-1"],
    } as never)).rejects.toMatchObject({ category: "validation" });
    expect(invites.size).toBe(0);
  });

  it("requires an employee role and at least one organization-owned project", async () => {
    const { useCases, invites } = fixture({ ownedProjectIds: ["project-1"] });
    await expect(useCases.create(admin, {
      registrationType: "EMPLOYEE", role: "MANAGER", projectIds: [],
    } as never)).rejects.toMatchObject({ category: "validation" });
    await expect(useCases.create(admin, {
      registrationType: "EMPLOYEE", role: "MANAGER", projectIds: ["other-project"],
    } as never)).rejects.toMatchObject({ category: "validation" });
    expect(invites.size).toBe(0);
  });

  it("allows only an admin to grant ADMIN", async () => {
    const { useCases, invites } = fixture();
    await expect(useCases.create(manager, {
      registrationType: "EMPLOYEE", role: "ADMIN", projectIds: ["project-1"],
    } as never)).rejects.toMatchObject({ category: "forbidden" });
    expect(invites.size).toBe(0);
  });

  it("retries a generated-code collision and returns an eight-character URL", async () => {
    const { useCases } = fixture({
      codes: ["EXISTING", "NEWCODE8"],
      seed: [employeeInvite()],
    });
    const invite = await useCases.create(admin, {
      registrationType: "EMPLOYEE", role: "GUEST", projectIds: ["project-1"],
    } as never);
    expect(invite.code).toBe("NEWCODE8");
    expect((invite as typeof invite & { registrationUrl: string }).registrationUrl)
      .toBe("/regustration/NEWCODE8");
  });
});

describe("public invitation resolution", () => {
  it("returns only the registration type for a pending invitation", async () => {
    const { useCases } = fixture({ seed: [employeeInvite()] });
    await expect((useCases as never as { resolve(code: string): Promise<unknown> }).resolve("EXISTING"))
      .resolves.toEqual({ registrationType: "EMPLOYEE" });
  });

  it.each([
    ["unknown", []],
    ["revoked", [employeeInvite({ revokedAt: NOW })]],
    ["used", [employeeInvite({ usedAt: NOW, usedById: "user-old" })]],
    ["expired", [employeeInvite({ expiresAt: new Date(NOW.getTime() - 1) })]],
  ])("uses one failure for an %s code", async (_label, seed) => {
    const { useCases } = fixture({ seed });
    await expect((useCases as never as { resolve(code: string): Promise<unknown> }).resolve("EXISTING"))
      .rejects.toMatchObject({ category: "not-found", message: "Invalid invite code" });
  });
});

describe("employee invitation redemption", () => {
  it("enrols and grants every selected project", async () => {
    const { useCases, transaction, grants } = fixture({ seed: [employeeInvite()] });
    await useCases.redeem(transaction, "EXISTING", "new@acme.com", "user-new", NOW);
    expect(grants).toEqual([{ membershipId: "membership-new", projectIds: ["project-1"] }]);
  });

  it("rolls membership, grants and claim back when a project grant fails", async () => {
    const { useCases, unitOfWork, invites, memberships, grants } = fixture({
      seed: [employeeInvite()], failGrant: true,
    });
    await expect(unitOfWork.run((context) =>
      useCases.redeem(context, "EXISTING", "new@acme.com", "user-new", NOW)))
      .rejects.toThrow("grant failed");
    expect(memberships).toEqual([]);
    expect(grants).toEqual([]);
    expect(invites.get("invite-existing")?.usedAt).toBeNull();
  });

  it("refuses client redemption without consuming the invitation", async () => {
    const clientInvite = employeeInvite({ registrationType: "CLIENT", role: null, projectIds: [] });
    const { useCases, transaction, invites } = fixture({ seed: [clientInvite] });
    await expect(useCases.redeem(transaction, "EXISTING", "new@acme.com", "user-new", NOW))
      .rejects.toMatchObject({ category: "forbidden", message: "Invalid invite code" });
    expect(invites.get("invite-existing")?.usedAt).toBeNull();
  });
});
