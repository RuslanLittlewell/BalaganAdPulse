import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "../../src/shared/application/index.js";
import { createConnectionRegistry, createTaskEventDelivery } from "../../src/modules/realtime/index.js";
import { taskDeleted, taskMoved } from "../../src/modules/tasks/index.js";
import type { TaskRecord } from "../../src/modules/tasks/index.js";
import type { SessionPrincipal } from "../../src/modules/identity/domain/identity-user.js";

const principal = (userId: string): SessionPrincipal => ({ userId }) as SessionPrincipal;

const actor = (partial: Partial<ActorContext> = {}): ActorContext =>
  ({ userId: "u1", membershipId: "m1", orgId: "org1", role: "ADMIN", ...partial });

const task: TaskRecord = {
  id: "t1", projectId: "p1", orgId: "org1", title: "Write the brief", description: null,
  column: "IDEA", priority: "MEDIUM", assigneeId: null, createdById: "m1",
  campaignId: null, visibleToClient: false, position: 0,
  imageIds: [], createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
};

function harness(options: {
  actors?: Record<string, ActorContext | null>;
  reach?: Record<string, string[]>;
} = {}) {
  const state = {
    actors: options.actors ?? { u1: actor() },
    reach: options.reach ?? { m1: ["p1"] },
  };
  const registry = createConnectionRegistry();
  const delivery = createTaskEventDelivery({
    registry,
    members: {
      resolveActor: async (p: SessionPrincipal) => {
        const resolved = state.actors[p.userId];
        if (!resolved) throw new Error("no membership");
        return resolved;
      },
    },
    projects: {
      contextFor: async (a: ActorContext, projectId: string) =>
        state.reach[a.membershipId]?.includes(projectId) ? { clientId: "c1" } : null,
    },
  });
  const connect = (userId: string) => {
    const send = vi.fn();
    registry.add({ principal: principal(userId), send });
    return send;
  };
  return { state, registry, delivery, connect };
}

describe("who receives a task event", () => {
  it("delivers to a member who reaches the project", async () => {
    const { delivery, connect } = harness();
    const send = connect("u1");

    await delivery.deliver(taskMoved(task));

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toMatchObject({ kind: "task.moved", task: { id: "t1" } });
  });

  it("withholds from a member in another organization", async () => {
    const { delivery, connect } = harness({
      actors: { u1: actor({ orgId: "org2" }) }, reach: { m1: ["p1"] },
    });
    const send = connect("u1");

    await delivery.deliver(taskMoved(task));

    expect(send).not.toHaveBeenCalled();
  });

  it("withholds the agency's own work from a customer", async () => {
    const { delivery, connect } = harness({ actors: { u1: actor({ role: "CLIENT" }) } });
    const send = connect("u1");

    await delivery.deliver(taskMoved(task));

    expect(send).not.toHaveBeenCalled();
  });

  it("delivers to a customer what is marked as shown to them", async () => {
    const { delivery, connect } = harness({ actors: { u1: actor({ role: "CLIENT" }) } });
    const send = connect("u1");

    await delivery.deliver(taskMoved({ ...task, visibleToClient: true }));

    expect(send).toHaveBeenCalledOnce();
  });

  it("withholds a colleague's task from a manager", async () => {
    const { delivery, connect } = harness({
      actors: { u1: actor({ role: "MANAGER", membershipId: "m1" }) },
    });
    const send = connect("u1");

    await delivery.deliver(taskMoved({ ...task, assigneeId: "m2" }));

    expect(send).not.toHaveBeenCalled();
  });

  it("withholds a task nobody is responsible for from a manager", async () => {
    const { delivery, connect } = harness({
      actors: { u1: actor({ role: "MANAGER", membershipId: "m1" }) },
    });
    const send = connect("u1");

    await delivery.deliver(taskMoved(task));

    expect(send).not.toHaveBeenCalled();
  });

  it("delivers to the manager who is responsible for it", async () => {
    const { delivery, connect } = harness({
      actors: { u1: actor({ role: "MANAGER", membershipId: "m1" }) },
    });
    const send = connect("u1");

    await delivery.deliver(taskMoved({ ...task, assigneeId: "m1" }));

    expect(send).toHaveBeenCalledOnce();
  });

  it("delivers everything in the organization to an admin", async () => {
    const { delivery, connect } = harness();
    const send = connect("u1");

    await delivery.deliver(taskMoved({ ...task, assigneeId: "m9" }));

    expect(send).toHaveBeenCalledOnce();
  });

  it("withholds a deletion from someone who could not see the task", async () => {
    const { delivery, connect } = harness({
      actors: { u1: actor({ role: "MANAGER", membershipId: "m1" }) },
    });
    const send = connect("u1");

    await delivery.deliver(taskDeleted({ ...task, assigneeId: "m2" }));

    expect(send).not.toHaveBeenCalled();
  });

  it("delivers a deletion to whoever could see the task", async () => {
    const { delivery, connect } = harness({
      actors: { u1: actor({ role: "MANAGER", membershipId: "m1" }) },
    });
    const send = connect("u1");

    await delivery.deliver(taskDeleted({ ...task, assigneeId: "m1" }));

    expect(send).toHaveBeenCalledOnce();
  });

  it("withholds from a member holding no grant over the project", async () => {
    const { delivery, connect } = harness({
      actors: { u1: actor({ role: "MANAGER" }) }, reach: { m1: ["p9"] },
    });
    const send = connect("u1");

    await delivery.deliver(taskMoved(task));

    expect(send).not.toHaveBeenCalled();
  });

  it("re-checks entitlement per event, so a revocation takes effect at once", async () => {
    const { state, delivery, connect } = harness({
      actors: { u1: actor({ role: "MANAGER" }) }, reach: { m1: ["p1"] },
    });
    const send = connect("u1");
    const theirs = taskMoved({ ...task, assigneeId: "m1" });

    await delivery.deliver(theirs);
    expect(send).toHaveBeenCalledTimes(1);

    state.reach = { m1: [] };
    await delivery.deliver(theirs);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("withholds when the membership no longer resolves at all", async () => {
    const { state, delivery, connect } = harness();
    const send = connect("u1");

    state.actors = { u1: null };
    await delivery.deliver(taskMoved(task));

    expect(send).not.toHaveBeenCalled();
  });

  it("delivers to every entitled connection and to no others", async () => {
    const { delivery, connect } = harness({
      actors: {
        admin: actor({ userId: "admin", membershipId: "m1", role: "ADMIN" }),
        granted: actor({ userId: "granted", membershipId: "m2", role: "MANAGER" }),
        ungranted: actor({ userId: "ungranted", membershipId: "m3", role: "MANAGER" }),
      },
      reach: { m1: ["p1"], m2: ["p1"], m3: [] },
    });
    const sends = [connect("admin"), connect("granted"), connect("ungranted")];

    await delivery.deliver(taskMoved({ ...task, assigneeId: "m2" }));

    expect(sends.map((send) => send.mock.calls.length)).toEqual([1, 1, 0]);
  });

  it("keeps delivering when one connection throws", async () => {
    const { delivery, registry, connect } = harness({
      actors: { u1: actor(), u2: actor({ userId: "u2" }) },
    });
    registry.add({
      principal: principal("u1"),
      send: () => { throw new Error("socket gone"); },
    });
    const healthy = connect("u2");

    await delivery.deliver(taskMoved(task));

    expect(healthy).toHaveBeenCalledTimes(1);
  });
});

describe("the connection registry", () => {
  it("stops delivering to a removed connection", async () => {
    const { delivery, registry } = harness();
    const send = vi.fn();
    const handle = registry.add({ principal: principal("u1"), send });

    handle.remove();
    await delivery.deliver(taskMoved(task));

    expect(send).not.toHaveBeenCalled();
  });

  it("counts what is currently connected", () => {
    const registry = createConnectionRegistry();
    const first = registry.add({ principal: principal("u1"), send: vi.fn() });
    registry.add({ principal: principal("u2"), send: vi.fn() });
    expect(registry.size()).toBe(2);
    first.remove();
    expect(registry.size()).toBe(1);
  });

  it("removing twice is harmless", () => {
    const registry = createConnectionRegistry();
    const handle = registry.add({ principal: principal("u1"), send: vi.fn() });
    handle.remove();
    handle.remove();
    expect(registry.size()).toBe(0);
  });
});
