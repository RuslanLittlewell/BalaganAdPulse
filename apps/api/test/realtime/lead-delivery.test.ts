import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "../../src/shared/application/index.js";
import { createConnectionRegistry, createLeadEventDelivery } from "../../src/modules/realtime/index.js";
import type { LeadEvent } from "../../src/modules/leads/index.js";
import type { SessionPrincipal } from "../../src/modules/identity/domain/identity-user.js";

const principal = (userId: string): SessionPrincipal => ({ userId }) as SessionPrincipal;

const actor = (partial: Partial<ActorContext> = {}): ActorContext =>
  ({ userId: "u1", membershipId: "m1", orgId: "org1", role: "ADMIN", ...partial });

const changed = (board: string, orgId = "org1"): LeadEvent =>
  ({ kind: "crm.changed", orgId, board });

function harness(options: {
  actors?: Record<string, ActorContext | null>;
  reach?: Record<string, string[]>;
} = {}) {
  const state = {
    actors: options.actors ?? { u1: actor() },
    reach: options.reach ?? { m1: ["agency"] },
  };
  const registry = createConnectionRegistry();
  const delivery = createLeadEventDelivery({
    registry,
    members: {
      resolveActor: async (p: SessionPrincipal) => {
        const resolved = state.actors[p.userId];
        if (!resolved) throw new Error("no membership");
        return resolved;
      },
    },
    boards: {
      reaches: async (context: ActorContext, board: string) =>
        (state.reach[context.membershipId] ?? []).includes(board),
    },
  });

  const listen = (userId: string) => {
    const send = vi.fn();
    registry.add({ principal: principal(userId), send });
    return send;
  };

  return { delivery, listen, state };
}

describe("delivering CRM changes", () => {
  it("tells a member watching the board that it changed, and nothing about its contents", async () => {
    const { delivery, listen } = harness();
    const send = listen("u1");

    await delivery.deliver(changed("agency"));

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toEqual({ kind: "crm.changed", orgId: "org1", board: "agency" });
    expect(JSON.stringify(send.mock.calls[0][0])).not.toMatch(/@|\+\d|name/i);
  });

  it("says nothing to a member who cannot reach that board", async () => {
    const { delivery, listen } = harness({ reach: { m1: ["agency"] } });
    const send = listen("u1");

    await delivery.deliver(changed("client-1"));

    expect(send).not.toHaveBeenCalled();
  });

  it("says nothing across organizations", async () => {
    const { delivery, listen } = harness();
    const send = listen("u1");

    await delivery.deliver(changed("agency", "org2"));

    expect(send).not.toHaveBeenCalled();
  });

  it("stops telling a member whose membership is gone", async () => {
    const { delivery, listen, state } = harness();
    const send = listen("u1");

    state.actors.u1 = null;
    await delivery.deliver(changed("agency"));

    expect(send).not.toHaveBeenCalled();
  });

  it("re-checks reach on every event, so a withdrawn grant stops delivery", async () => {
    const { delivery, listen, state } = harness({ reach: { m1: ["agency", "client-1"] } });
    const send = listen("u1");

    await delivery.deliver(changed("client-1"));
    expect(send).toHaveBeenCalledTimes(1);

    state.reach.m1 = ["agency"];
    await delivery.deliver(changed("client-1"));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps delivering to the others when one connection throws", async () => {
    const { delivery, listen } = harness({
      actors: { u1: actor(), u2: actor({ userId: "u2", membershipId: "m1" }) },
    });
    const registryThrows = listen("u1");
    registryThrows.mockImplementation(() => { throw new Error("socket is gone"); });
    const send = listen("u2");

    await delivery.deliver(changed("agency"));

    expect(send).toHaveBeenCalledTimes(1);
  });
});
