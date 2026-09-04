import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  PrismaActorSnapshots,
  PrismaAuditReach,
  PrismaAuditRepository,
} from "../../src/modules/audit/infrastructure/prisma-audit-repository.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, grantAccess, signInAs } from "../helpers/auth.js";
import type { StoredAuditEvent } from "../../src/modules/audit/index.js";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

function adapters() {
  const unitOfWork = new PrismaUnitOfWork<Prisma.TransactionClient>(prisma);
  return {
    unitOfWork,
    events: new PrismaAuditRepository(prisma, unitOfWork),
    reach: new PrismaAuditReach(prisma),
    snapshots: new PrismaActorSnapshots(unitOfWork),
  };
}

async function event(overrides: Partial<StoredAuditEvent> = {}): Promise<StoredAuditEvent> {
  const org = await currentOrg();
  return {
    orgId: org.id, actorId: null, actorName: "Buyer", actorEmail: "buyer@acme.com",
    actorRole: "ADMIN", action: "CREATE", entityType: "client", entityId: "c1",
    clientId: null, projectId: null, campaignId: null, summary: "Created client “Acme”",
    changes: null, requestId: null, ip: null, userAgent: null, ...overrides,
  };
}

describe("Prisma audit repository", () => {
  it("stores an event with its actor snapshot and request metadata", async () => {
    const { unitOfWork, events } = adapters();
    await unitOfWork.run(async (context) => events.append(context, await event({
      requestId: "req-1", ip: "203.0.113.7", userAgent: "agent",
    })));

    const stored = await prisma.auditEvent.findFirstOrThrow();
    expect(stored).toMatchObject({
      actorName: "Buyer", actorEmail: "buyer@acme.com", actorRole: "ADMIN",
      requestId: "req-1", ip: "203.0.113.7", userAgent: "agent",
    });
  });

  it("stores a change list and reads it back", async () => {
    const { unitOfWork, events } = adapters();
    const changes = [{ field: "SPEND", before: null, after: "1.0000" }];
    await unitOfWork.run(async (context) => events.append(context, await event({ changes })));
    expect((await prisma.auditEvent.findFirstOrThrow()).changes).toEqual(changes);
  });

  it("rolls the event back with the mutation it describes", async () => {
    const { unitOfWork, events } = adapters();
    await expect(unitOfWork.run(async (context) => {
      await events.append(context, await event());
      throw new Error("the mutation failed");
    })).rejects.toThrow("the mutation failed");
    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it("commits the event and the mutation together", async () => {
    const { unitOfWork, events } = adapters();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const org = await currentOrg();
    await unitOfWork.run(async (context) => {
      const client = await prisma.client.create({ data: { name: "Acme", orgId: org.id } });
      await events.append(context, await event({ entityId: client.id, clientId: client.id }));
    });
    expect(await prisma.auditEvent.count()).toBe(1);
    expect(admin.user.id).toBeTruthy();
  });

  describe("reading", () => {
    async function threeEvents() {
      const { unitOfWork, events } = adapters();
      const admin = await signInAs("Admin", { role: "ADMIN" });
      const acme = await seedProject(admin.user.id, "Acme");
      const globex = await seedProject(admin.user.id, "Globex");
      for (const [index, spec] of [
        { clientId: acme.clientId, projectId: null },
        { clientId: acme.clientId, projectId: acme.projectId },
        { clientId: globex.clientId, projectId: null },
      ].entries()) {
        await unitOfWork.run(async (context) => events.append(context, await event({
          entityId: `e${index}`, ...spec,
        })));
      }
      return { acme, globex };
    }

    it("returns events newest first", async () => {
      await threeEvents();
      const { events, reach } = adapters();
      const admin = await signInAs("Reader", { role: "ADMIN" });
      const page = await events.list({ scope: await reach.scopeFor(admin.actor!), filters: {}, limit: 50 });
      expect(page.items.map((item) => item.entityId)).toEqual(["e2", "e1", "e0"]);
    });

    it("pages with a cursor and reports when there is more", async () => {
      await threeEvents();
      const { events, reach } = adapters();
      const admin = await signInAs("Reader", { role: "ADMIN" });
      const scope = await reach.scopeFor(admin.actor!);

      const first = await events.list({ scope, filters: {}, limit: 2 });
      expect(first.items).toHaveLength(2);
      expect(first.nextCursor).toBe(first.items[1]!.id);

      const second = await events.list({ scope, filters: {}, limit: 2, cursor: first.nextCursor! });
      expect(second.items.map((item) => item.entityId)).toEqual(["e0"]);
      expect(second.nextCursor).toBeNull();
    });

    it("filters by client and by entity", async () => {
      const { globex } = await threeEvents();
      const { events, reach } = adapters();
      const admin = await signInAs("Reader", { role: "ADMIN" });
      const scope = await reach.scopeFor(admin.actor!);

      expect((await events.list({ scope, filters: { clientId: globex.clientId }, limit: 50 }))
        .items.map((item) => item.entityId)).toEqual(["e2"]);
      expect((await events.list({ scope, filters: { entityId: "e0" }, limit: 50 }))
        .items.map((item) => item.entityId)).toEqual(["e0"]);
    });

    it("narrows a manager to the history their grants reach", async () => {
      const { acme } = await threeEvents();
      const { events, reach } = adapters();
      const manager = await signInAs("Manager", { role: "MANAGER" });
      await grantAccess(manager.membership!.id, acme.clientId);

      const page = await events.list({
        scope: await reach.scopeFor(manager.actor!), filters: {}, limit: 50,
      });
      expect(page.items.map((item) => item.entityId).sort()).toEqual(["e0", "e1"]);
    });

    it("gives a project-scoped grant that project's events and the client record's own", async () => {
      const { acme } = await threeEvents();
      const { events, reach } = adapters();
      const manager = await signInAs("Manager", { role: "MANAGER" });
      await grantAccess(manager.membership!.id, acme.clientId, acme.projectId);

      const page = await events.list({
        scope: await reach.scopeFor(manager.actor!), filters: {}, limit: 50,
      });
      expect(page.items.map((item) => item.entityId).sort()).toEqual(["e0", "e1"]);
    });

    it("shows an ungranted manager nothing", async () => {
      await threeEvents();
      const { events, reach } = adapters();
      const manager = await signInAs("Manager", { role: "MANAGER" });
      const page = await events.list({
        scope: await reach.scopeFor(manager.actor!), filters: {}, limit: 50,
      });
      expect(page.items).toEqual([]);
    });
  });
});

describe("Prisma actor snapshots", () => {
  it("reads the member's name and email as they stand now", async () => {
    const { unitOfWork, snapshots } = adapters();
    const member = await signInAs("Snapshot Me", { role: "MANAGER" });
    const snapshot = await unitOfWork.run((context) =>
      snapshots.forMembership(context, member.membership!.id));
    expect(snapshot).toEqual({ name: "Snapshot Me", email: member.user.email });
  });
});
