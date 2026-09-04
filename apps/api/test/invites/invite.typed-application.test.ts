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
  failClientCreation?: boolean;
  failProjectCreation?: boolean;
  ownedClientIds?: string[];
  clientProjectIds?: Record<string, string[]>;
  reachableClientIds?: Record<string, string[]>;
} = {}) {
  const transaction = {} as TransactionContext;
  const invites = new Map((options.seed ?? []).map((invite) => [invite.id, invite]));
  const memberships: string[] = [];
  const grants: Array<{ membershipId: string; projectIds: readonly string[] }> = [];
  const clients: Array<{ id: string; name: string }> = [];
  const enrolments: Array<{ role: string; orgId: string }> = [];
  const projects: Array<{ id: string; clientId: string; name: string }> = [];
  const codes = [...(options.codes ?? ["ABCDEFGH"])];
  let id = 0;

  const unitOfWork = {
    run: async <T>(work: (context: TransactionContext) => Promise<T>) => {
      const inviteSnapshot = new Map(invites);
      const membershipCount = memberships.length;
      const grantCount = grants.length;
      const clientCount = clients.length;
      const enrolmentCount = enrolments.length;
      const projectCount = projects.length;
      try {
        return await work(transaction);
      } catch (error) {
        invites.clear();
        inviteSnapshot.forEach((value, key) => invites.set(key, value));
        memberships.length = membershipCount;
        grants.length = grantCount;
        clients.length = clientCount;
        enrolments.length = enrolmentCount;
        projects.length = projectCount;
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
      enrol: async (_context: TransactionContext, value: { orgId: string; role: string }) => {
        memberships.push("membership-new");
        enrolments.push({ role: value.role, orgId: value.orgId });
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
    clientProjects: {
      projectIdsOf: async (clientId: string) => options.clientProjectIds?.[clientId] ?? [],
    },
    clients: {
      isReachable: async (a: ActorContext, clientId: string) => {
        const exists = (options.ownedClientIds ?? []).includes(clientId);
        if (!exists) return false;
        return a.role === "ADMIN"
          || (options.reachableClientIds?.[a.membershipId] ?? []).includes(clientId);
      },
    },
    clientDirectory: {
      create: async (_context: TransactionContext, input: { orgId: string; name: string }) => {
        if (options.failClientCreation) throw new Error("client failed");
        const created = { id: `client-${clients.length + 1}`, name: input.name };
        clients.push(created);
        return created.id;
      },
    },
    projectDirectory: {
      create: async (
        _context: TransactionContext,
        input: { clientId: string; name: string },
      ) => {
        if (options.failProjectCreation) throw new Error("project failed");
        const created = { id: `project-${projects.length + 1}`, clientId: input.clientId, name: input.name };
        projects.push(created);
        return created.id;
      },
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
    clients,
    projects,
    enrolments,
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

  it("refuses client redemption offered no details, without consuming the invitation", async () => {
    const typed = employeeInvite({ registrationType: "CLIENT", role: null, projectIds: [] });
    const { useCases, transaction, invites } = fixture({ seed: [typed] });

    await expect(useCases.redeem(transaction, "EXISTING", "new@acme.com", "user-new", NOW))
      .rejects.toMatchObject({ category: "validation" });

    expect(invites.get("invite-existing")?.usedAt).toBeNull();
  });
});

function clientInvite(overrides: Partial<Invite> = {}): Invite {
  return {
    id: "invite-client",
    orgId: "org-1",
    code: "CLIENTAB",
    registrationType: "CLIENT",
    role: null,
    projectIds: [],
    email: null,
    createdById: null,
    expiresAt: null,
    createdAt: NOW,
    usedAt: null,
    usedById: null,
    revokedAt: null,
    ...overrides,
  };
}

const CLIENT_REGISTRATION = {
  client: { name: "Клиника", organization: "ООО Клиника", phone: "+375291112233" },
  project: { name: "Стоматология", niche: "Медицина" },
};

describe("redeeming a client invitation", () => {
  it("creates the account's client and its first project together", async () => {
    const f = fixture({ seed: [clientInvite()] });

    await f.useCases.redeem(f.transaction, "CLIENTAB", "c@acme.com", "u-new", NOW, CLIENT_REGISTRATION);

    expect(f.clients).toEqual([{ id: "client-1", name: "Клиника" }]);
    expect(f.projects).toEqual([{ id: "project-1", clientId: "client-1", name: "Стоматология" }]);
  });

  it("enrols the account as a client and grants it that client alone", async () => {
    const f = fixture({ seed: [clientInvite()] });

    await f.useCases.redeem(f.transaction, "CLIENTAB", "c@acme.com", "u-new", NOW, CLIENT_REGISTRATION);

    expect(f.memberships).toHaveLength(1);
    expect(f.grants).toEqual([{ membershipId: "membership-new", projectIds: ["project-1"] }]);
  });

  it("spends the invitation", async () => {
    const f = fixture({ seed: [clientInvite()] });

    await f.useCases.redeem(f.transaction, "CLIENTAB", "c@acme.com", "u-new", NOW, CLIENT_REGISTRATION);

    expect(f.invites.get("invite-client")?.usedAt).toEqual(NOW);
  });

  it("stores nothing when the project cannot be created", async () => {
    const f = fixture({ seed: [clientInvite()], failProjectCreation: true });

    await expect(f.unitOfWork.run((context) =>
      f.useCases.redeem(context, "CLIENTAB", "c@acme.com", "u-new", NOW, CLIENT_REGISTRATION),
    )).rejects.toThrow();

    expect(f.clients).toEqual([]);
    expect(f.projects).toEqual([]);
    expect(f.memberships).toEqual([]);
    expect(f.invites.get("invite-client")?.usedAt).toBeNull();
  });

  it("stores nothing when the client cannot be created", async () => {
    const f = fixture({ seed: [clientInvite()], failClientCreation: true });

    await expect(f.unitOfWork.run((context) =>
      f.useCases.redeem(context, "CLIENTAB", "c@acme.com", "u-new", NOW, CLIENT_REGISTRATION),
    )).rejects.toThrow();

    expect(f.clients).toEqual([]);
    expect(f.invites.get("invite-client")?.usedAt).toBeNull();
  });

  it("refuses a client invitation redeemed without the details it needs", async () => {
    const f = fixture({ seed: [clientInvite()] });

    await expect(f.useCases.redeem(f.transaction, "CLIENTAB", "c@acme.com", "u-new", NOW))
      .rejects.toMatchObject({ category: "validation" });
  });

  it("refuses an employee invitation redeemed as a client", async () => {
    const f = fixture({ seed: [employeeInvite()] });

    await expect(f.useCases.redeem(
      f.transaction, "EXISTING", "e@acme.com", "u-new", NOW, CLIENT_REGISTRATION,
    )).rejects.toMatchObject({ category: "validation" });
  });

  it("refuses a client invitation redeemed as an employee", async () => {
    const f = fixture({ seed: [clientInvite()] });

    await expect(f.useCases.redeem(f.transaction, "CLIENTAB", "c@acme.com", "u-new", NOW))
      .rejects.toMatchObject({ category: "validation" });
  });
});

describe("inviting somebody to an existing client", () => {
  const principal: ActorContext = {
    userId: "u-principal", membershipId: "m-principal", orgId: "org-1", role: "CLIENT_ADMIN",
  };
  const customer: ActorContext = { ...principal, membershipId: "m-customer", role: "CLIENT" };

  it("stores it against the client an admin names", async () => {
    const f = fixture({ ownedClientIds: ["client-1"] });

    const created = await f.useCases.create(admin, {
      registrationType: "CLIENT_STAFF", clientId: "client-1",
    });

    expect(created).toMatchObject({
      registrationType: "CLIENT_STAFF", clientId: "client-1", role: null, projectIds: [],
    });
  });

  it("lets a principal invite to their own client", async () => {
    const f = fixture({ ownedClientIds: ["client-1"], reachableClientIds: { "m-principal": ["client-1"] } });

    const created = await f.useCases.create(principal, {
      registrationType: "CLIENT_STAFF", clientId: "client-1",
    });

    expect(created.clientId).toBe("client-1");
  });

  it("refuses a principal naming somebody else's client", async () => {
    const f = fixture({
      ownedClientIds: ["client-1", "client-2"],
      reachableClientIds: { "m-principal": ["client-1"] },
    });

    await expect(f.useCases.create(principal, {
      registrationType: "CLIENT_STAFF", clientId: "client-2",
    })).rejects.toMatchObject({ category: "not-found" });
  });

  it("refuses a principal naming a client that does not exist, the same way", async () => {
    const f = fixture({ reachableClientIds: { "m-principal": ["client-1"] } });

    await expect(f.useCases.create(principal, {
      registrationType: "CLIENT_STAFF", clientId: "nowhere",
    })).rejects.toMatchObject({ category: "not-found" });
  });

  it("refuses an ordinary customer outright", async () => {
    const f = fixture({ ownedClientIds: ["client-1"] });

    await expect(f.useCases.create(customer, {
      registrationType: "CLIENT_STAFF", clientId: "client-1",
    })).rejects.toMatchObject({ category: "forbidden" });
  });

  it("refuses one that names no client", async () => {
    const f = fixture();

    await expect(f.useCases.create(admin, { registrationType: "CLIENT_STAFF" }))
      .rejects.toMatchObject({ category: "validation" });
  });

  it("refuses a role or projects on it", async () => {
    const f = fixture({ ownedClientIds: ["client-1"] });

    await expect(f.useCases.create(admin, {
      registrationType: "CLIENT_STAFF", clientId: "client-1", role: "MANAGER",
    })).rejects.toMatchObject({ category: "validation" });
  });
});

describe("redeeming an invitation to join a client", () => {
  const joining = (overrides: Partial<Invite> = {}): Invite => clientInvite({
    id: "invite-join", code: "JOINABCD", registrationType: "CLIENT_STAFF",
    clientId: "client-1", ...overrides,
  });

  it("enrols the account against that client and grants its projects", async () => {
    const f = fixture({ seed: [joining()], clientProjectIds: { "client-1": ["project-7"] } });

    await f.useCases.redeem(f.transaction, "JOINABCD", "new@clinic.by", "u-new", NOW);

    expect(f.memberships).toHaveLength(1);
    expect(f.grants).toEqual([{ membershipId: "membership-new", projectIds: ["project-7"] }]);
  });

  it("makes them an ordinary member, never the principal", async () => {
    const f = fixture({ seed: [joining()], clientProjectIds: { "client-1": ["project-7"] } });

    await f.useCases.redeem(f.transaction, "JOINABCD", "new@clinic.by", "u-new", NOW);

    expect(f.enrolments).toEqual([{ role: "CLIENT", orgId: "org-1" }]);
  });

  it("spends the invitation", async () => {
    const f = fixture({ seed: [joining()], clientProjectIds: { "client-1": ["project-7"] } });

    await f.useCases.redeem(f.transaction, "JOINABCD", "new@clinic.by", "u-new", NOW);

    expect(f.invites.get("invite-join")?.usedAt).toEqual(NOW);
  });

  it("creates no client and no project: both already exist", async () => {
    const f = fixture({ seed: [joining()], clientProjectIds: { "client-1": ["project-7"] } });

    await f.useCases.redeem(f.transaction, "JOINABCD", "new@clinic.by", "u-new", NOW);

    expect(f.clients).toEqual([]);
    expect(f.projects).toEqual([]);
  });

  it("stores nothing when the grant fails, and leaves the link usable", async () => {
    const f = fixture({
      seed: [joining()], clientProjectIds: { "client-1": ["project-7"] }, failGrant: true,
    });

    await expect(f.unitOfWork.run((context) =>
      f.useCases.redeem(context, "JOINABCD", "new@clinic.by", "u-new", NOW),
    )).rejects.toThrow();

    expect(f.memberships).toEqual([]);
    expect(f.invites.get("invite-join")?.usedAt).toBeNull();
  });

  it("refuses the client details a registration would carry", async () => {
    const f = fixture({ seed: [joining()], clientProjectIds: { "client-1": ["project-7"] } });

    await expect(f.useCases.redeem(
      f.transaction, "JOINABCD", "new@clinic.by", "u-new", NOW, CLIENT_REGISTRATION,
    )).rejects.toMatchObject({ category: "validation" });
  });
});

describe("what a principal sees of the invitations", () => {
  const principalActor: ActorContext = {
    userId: "u-principal", membershipId: "m-principal", orgId: "org-1", role: "CLIENT_ADMIN",
  };
  const mine = clientInvite({
    id: "invite-mine", code: "MINEABCD", registrationType: "CLIENT_STAFF", clientId: "client-1",
  });
  const theirs = clientInvite({
    id: "invite-theirs", code: "THRSABCD", registrationType: "CLIENT_STAFF", clientId: "client-2",
  });
  const agency = employeeInvite({ id: "invite-agency", code: "AGENCYAB" });

  const reachable = { "m-principal": ["client-1"] };

  it("lists its own client's invitations alone", async () => {
    const f = fixture({
      seed: [mine, theirs, agency],
      ownedClientIds: ["client-1", "client-2"],
      reachableClientIds: reachable,
    });

    const listed = await f.useCases.list(principalActor);

    expect(listed.map((invite) => invite.id)).toEqual(["invite-mine"]);
  });

  it("leaves an admin seeing every invitation in the organization", async () => {
    const f = fixture({
      seed: [mine, theirs, agency],
      ownedClientIds: ["client-1", "client-2"],
      reachableClientIds: reachable,
    });

    const listed = await f.useCases.list(admin);

    expect(listed.map((invite) => invite.id).sort())
      .toEqual(["invite-agency", "invite-mine", "invite-theirs"]);
  });

  it("revokes its own client's invitation", async () => {
    const f = fixture({
      seed: [mine], ownedClientIds: ["client-1"], reachableClientIds: reachable,
    });

    await expect(f.useCases.revoke(principalActor, "invite-mine")).resolves.toBeUndefined();
  });

  it("is told a stranger's invitation does not exist", async () => {
    const f = fixture({
      seed: [theirs], ownedClientIds: ["client-1", "client-2"], reachableClientIds: reachable,
    });

    await expect(f.useCases.revoke(principalActor, "invite-theirs"))
      .rejects.toMatchObject({ category: "not-found" });
  });

  it("is told the agency's own invitation does not exist either", async () => {
    const f = fixture({
      seed: [agency], ownedClientIds: ["client-1"], reachableClientIds: reachable,
    });

    await expect(f.useCases.revoke(principalActor, "invite-agency"))
      .rejects.toMatchObject({ category: "not-found" });
  });
});
