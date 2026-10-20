import { describe, expect, it } from "vitest";
import type { ActorContext } from "../../src/shared/application/index.js";
import type { TransactionContext } from "../../src/shared/application/unit-of-work.js";
import { createAuditReader, createAuditWriter } from "../../src/modules/audit/index.js";
import type { StoredAuditEvent } from "../../src/modules/audit/index.js";

const admin: ActorContext = { userId: "u1", membershipId: "m1", orgId: "org1", role: "ADMIN" };
const manager: ActorContext = { ...admin, membershipId: "m2", role: "MANAGER" };
const guest: ActorContext = { ...admin, membershipId: "m3", role: "GUEST" };

function fixture(options: { metadata?: { requestId: string; ip: string | null; userAgent: string | null } } = {}) {
  const context = {} as TransactionContext;
  const appended: StoredAuditEvent[] = [];
  const queries: unknown[] = [];

  const dependencies = {
    events: {
      append: async (_tx: TransactionContext, event: StoredAuditEvent) => { appended.push(event); },
      list: async (query: unknown) => { queries.push(query); return { items: [], nextCursor: null }; },
      actors: async (scope: unknown) => {
        queries.push(scope);
        return [{ id: "m-b", name: "Борис" }, { id: "m-a", name: "Анна" }, { id: "m-e", name: "Ёжиков" }, { id: "m-z", name: "Женя" }];
      },
    },
    reach: {
      scopeFor: async (actor: ActorContext) =>
        actor.role === "ADMIN"
          ? { orgId: actor.orgId, everything: true as const }
          : { orgId: actor.orgId, everything: false as const, clientIds: ["c1"], wholeClientIds: ["c1"], projectIds: ["p1"] },
    },
    metadata: {
      current: () => options.metadata ?? { requestId: "req-1", ip: "203.0.113.7", userAgent: "agent" },
    },
    snapshots: {
      forMembership: async (_tx: TransactionContext, membershipId: string) => ({
        name: `Name ${membershipId}`, email: `${membershipId}@acme.com`,
      }),
    },
  };
  return {
    writer: createAuditWriter(dependencies),
    reader: createAuditReader(dependencies),
    appended, queries, context,
  };
}

describe("appending an event", () => {
  it("dates the event at the moment it happened when told, and leaves it to the store otherwise", async () => {
    const { writer, appended, context } = fixture();
    const at = new Date("2026-10-20T07:05:00Z");
    await writer.append(context, { action: "OFFLINE", entityType: "member", entityId: "m1", summary: "Went offline", occurredAt: at }, admin);
    await writer.append(context, { action: "ONLINE", entityType: "member", entityId: "m1", summary: "Came online" }, admin);

    expect(appended[0]).toMatchObject({ action: "OFFLINE", createdAt: at });
    expect(appended[1]).not.toHaveProperty("createdAt");
  });

  it("snapshots the actor as they are at write time", async () => {
    const { writer, appended, context } = fixture();
    await writer.append(context, {
      action: "CREATE", entityType: "client", entityId: "c1", summary: "Created client “Acme”",
    }, admin);

    expect(appended[0]).toMatchObject({
      orgId: "org1", actorId: "m1", actorName: "Name m1",
      actorEmail: "m1@acme.com", actorRole: "ADMIN",
      action: "CREATE", entityType: "client", entityId: "c1",
    });
  });

  it("carries the request metadata onto the event", async () => {
    const { writer, appended, context } = fixture();
    await writer.append(context, {
      action: "CREATE", entityType: "client", entityId: "c1", summary: "s",
    }, admin);
    expect(appended[0]).toMatchObject({
      requestId: "req-1", ip: "203.0.113.7", userAgent: "agent",
    });
  });

  it("stores a null for every context column the caller left out", async () => {
    const { writer, appended, context } = fixture();
    await writer.append(context, {
      action: "CREATE", entityType: "client", entityId: "c1", summary: "s",
    }, admin);
    expect(appended[0]).toMatchObject({ clientId: null, projectId: null, campaignId: null });
  });

  it("works with no request metadata at all, as a background job would", async () => {
    const { writer, appended, context } = fixture({ metadata: undefined });
    const bare = createAuditWriter({
      events: { append: async (_tx, event) => { appended.push(event); }, list: async () => ({ items: [], nextCursor: null }) },
      reach: { scopeFor: async () => ({ orgId: "org1", everything: true as const }) },
      metadata: { current: () => undefined },
      snapshots: { forMembership: async () => ({ name: "N", email: "e@acme.com" }) },
    });
    await bare.append(context, { action: "DELETE", entityType: "client", entityId: "c1", summary: "s" }, admin);
    expect(appended.at(-1)).toMatchObject({ requestId: null, ip: null, userAgent: null });
  });

  it("refuses to write without an actor, rather than recording an anonymous change", async () => {
    const { writer, context } = fixture();
    await expect(
      writer.append(context, { action: "CREATE", entityType: "client", entityId: "c1", summary: "s" }),
    ).rejects.toThrow(/actor/i);
  });
});

describe("reading the trail", () => {
  it("gives an admin their whole organization", async () => {
    const { reader, queries } = fixture();
    await reader.list(admin, { limit: 50 });
    expect(queries[0]).toMatchObject({ scope: { orgId: "org1", everything: true } });
  });

  it("narrows a manager to what their grants reach", async () => {
    const { reader, queries } = fixture();
    await reader.list(manager, { limit: 50 });
    expect(queries[0]).toMatchObject({
      scope: { everything: false, clientIds: ["c1"], projectIds: ["p1"] },
    });
  });

  it("passes every filter straight through", async () => {
    const { reader, queries } = fixture();
    await reader.list(admin, {
      limit: 10, clientId: "c1", projectId: "p1", campaignId: "cam1",
      entityType: "record", entityId: "r1", actorId: "m9",
      from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z", cursor: "e1",
    });
    expect(queries[0]).toMatchObject({
      filters: {
        clientId: "c1", projectId: "p1", campaignId: "cam1",
        entityType: "record", entityId: "r1", actorId: "m9",
      },
      limit: 10, cursor: "e1",
    });
  });

  it("lets a guest read, because reach not role decides how much they see", async () => {
    const { reader } = fixture();
    await expect(reader.list(guest, { limit: 50 })).resolves.toBeDefined();
  });
});

describe("listing the actors", () => {
  it("asks within the reader's scope and orders them by name in Russian", async () => {
    const { reader, queries } = fixture();

    const actors = await reader.actors(manager);

    expect(actors.map((actor) => actor.name)).toEqual(["Анна", "Борис", "Ёжиков", "Женя"]);
    expect(queries).toEqual([{ orgId: "org1", everything: false, clientIds: ["c1"], wholeClientIds: ["c1"], projectIds: ["p1"] }]);
  });
});
