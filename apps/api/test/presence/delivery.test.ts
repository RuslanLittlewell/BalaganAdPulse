import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "../../src/shared/application/index.js";
import { createConnectionRegistry, createPresenceDelivery } from "../../src/modules/realtime/index.js";
import { createPresenceRegistry } from "../../src/modules/presence/index.js";
import type { PresencePerson } from "../../src/modules/presence/index.js";
import type { SessionPrincipal } from "../../src/modules/identity/domain/identity-user.js";

const principal = (userId: string): SessionPrincipal =>
  ({ id: userId, name: userId, email: `${userId}@example.com` });

const person = (userId: string, fields: Partial<PresencePerson> = {}): PresencePerson => ({
  userId,
  membershipId: `m-${userId}`,
  orgId: "org-1",
  role: "MANAGER",
  name: `Имя ${userId}`,
  image: null,
  clientIds: [],
  ...fields,
});

const actor = (userId: string, fields: Partial<ActorContext> = {}): ActorContext => ({
  userId,
  membershipId: `m-${userId}`,
  orgId: "org-1",
  role: "ADMIN",
  ...fields,
});

function harness() {
  const actors: Record<string, ActorContext> = {};
  const reach: Record<string, readonly string[]> = {};
  const connections = createConnectionRegistry();
  const presence = createPresenceRegistry();
  const delivery = createPresenceDelivery({
    connections,
    presence,
    members: {
      resolveActor: async (who: SessionPrincipal) => {
        const resolved = actors[who.id];
        if (!resolved) throw new Error("no membership");
        return resolved;
      },
    },
    clients: { reachableIds: async (who: ActorContext) => reach[who.membershipId] ?? [] },
  });

  const connect = (userId: string, as: ActorContext = actor(userId)) => {
    actors[userId] = as;
    const send = vi.fn();
    const connection = { principal: principal(userId), send };
    connections.add(connection);
    return { connection, send };
  };

  return { actors, reach, presence, delivery, connect };
}

describe("the roster a connection is given as it opens", () => {
  it("holds everyone online that the viewer may see", async () => {
    const { presence, delivery, connect } = harness();
    presence.join(person("u2", { name: "Мария" }));
    presence.join(person("u3", { name: "Пётр", image: "2026-09-01T00:00:00.000Z" }));
    const { connection, send } = connect("u1");

    await delivery.greet(connection);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toMatchObject({
      kind: "presence.state",
      people: [
        { userId: "u2", membershipId: "m-u2", name: "Мария", image: null },
        { userId: "u3", name: "Пётр", image: "2026-09-01T00:00:00.000Z" },
      ],
    });
  });

  it("leaves out another organization and another client's people", async () => {
    const { presence, delivery, connect, reach } = harness();
    presence.join(person("u2", { orgId: "org-2" }));
    presence.join(person("u3", { role: "CLIENT", clientIds: ["c2"] }));
    presence.join(person("u4", { role: "CLIENT", clientIds: ["c1"] }));
    reach["m-u1"] = ["c1"];
    const { connection, send } = connect("u1", actor("u1", { role: "CLIENT" }));

    await delivery.greet(connection);

    expect(send.mock.calls[0]![0]).toMatchObject({
      kind: "presence.state",
      people: [{ userId: "u4" }],
    });
  });
});

describe("what an open connection is told afterwards", () => {
  it("announces an arrival to everyone entitled to see it", async () => {
    const { delivery, connect } = harness();
    const staff = connect("u1");

    await delivery.deliverJoined(person("u2", { name: "Мария" }));

    expect(staff.send).toHaveBeenCalledTimes(1);
    expect(staff.send.mock.calls[0]![0]).toMatchObject({
      kind: "presence.joined",
      person: { userId: "u2", name: "Мария" },
    });
  });

  it("says nothing to a customer about another client's arrival", async () => {
    const { delivery, connect, reach } = harness();
    reach["m-u1"] = ["c1"];
    const customer = connect("u1", actor("u1", { role: "CLIENT" }));

    await delivery.deliverJoined(person("u2", { role: "CLIENT", clientIds: ["c2"] }));

    expect(customer.send).not.toHaveBeenCalled();
  });

  it("says nothing to another organization", async () => {
    const { delivery, connect } = harness();
    const outsider = connect("u1", actor("u1", { orgId: "org-2" }));

    await delivery.deliverJoined(person("u2"));

    expect(outsider.send).not.toHaveBeenCalled();
  });

  it("announces a departure by identity alone", async () => {
    const { delivery, connect } = harness();
    const staff = connect("u1");

    await delivery.deliverLeft(person("u2"));

    expect(staff.send.mock.calls[0]![0]).toEqual({ kind: "presence.left", userId: "u2" });
  });

  it("does not tell somebody about a departure they could not see", async () => {
    const { delivery, connect, reach } = harness();
    reach["m-u1"] = ["c1"];
    const customer = connect("u1", actor("u1", { role: "CLIENT" }));

    await delivery.deliverLeft(person("u2", { role: "CLIENT", clientIds: ["c2"] }));

    expect(customer.send).not.toHaveBeenCalled();
  });
});
