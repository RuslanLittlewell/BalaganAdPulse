import { describe, expect, it, vi } from "vitest";
import {
  createPresenceRegistry,
  createPresenceService,
  type PresencePerson,
} from "../../src/modules/presence/index.js";
import type { ActorContext } from "../../src/shared/application/index.js";

const WINDOW_MS = 5 * 60_000;
const START = Date.parse("2026-10-20T07:00:00Z");

const actor: ActorContext = { userId: "u1", membershipId: "m1", orgId: "org1", role: "MANAGER" };

function setup() {
  let now = START;
  const registry = createPresenceRegistry({ now: () => now, windowMs: WINDOW_MS });
  const joined: [PresencePerson, Date][] = [];
  const left: [PresencePerson, Date][] = [];
  const service = createPresenceService({
    registry,
    profiles: { describe: async () => ({ image: null, clientIds: [] }) },
    announce: {
      joined: (person, at) => { joined.push([person, at]); },
      left: (person, at) => { left.push([person, at]); },
    },
    clock: { now: () => new Date(now) },
  });
  return { service, joined, left, pass: (ms: number) => { now += ms; } };
}

describe("dating arrivals and departures", () => {
  it("dates an arrival at the request that brought the member back", async () => {
    const { service, joined } = setup();

    service.touch(actor, "Мария");

    await vi.waitFor(() => expect(joined).toHaveLength(1));
    expect(joined[0]![0]).toMatchObject({ userId: "u1", membershipId: "m1", name: "Мария" });
    expect(joined[0]![1]).toEqual(new Date(START));
  });

  it("dates a lapse at the last request, not at the sweep that noticed it", async () => {
    const { service, left, joined, pass } = setup();
    service.touch(actor, "Мария");
    await vi.waitFor(() => expect(joined).toHaveLength(1));
    pass(2 * 60_000);
    service.touch(actor, "Мария");

    pass(WINDOW_MS + 30_000);
    service.sweep();

    expect(left.map(([person, at]) => [person.userId, at])).toEqual([["u1", new Date(START + 2 * 60_000)]]);
  });

  it("dates a sign-out at that moment", async () => {
    const { service, left, joined, pass } = setup();
    service.touch(actor, "Мария");
    await vi.waitFor(() => expect(joined).toHaveLength(1));
    pass(60_000);

    service.leave("u1");
    service.leave("u1");

    expect(left.map(([, at]) => at)).toEqual([new Date(START + 60_000)]);
  });
});
