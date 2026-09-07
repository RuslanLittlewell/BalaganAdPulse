import { describe, expect, it } from "vitest";
import { createPresenceRegistry } from "../../src/modules/presence/index.js";
import type { PresencePerson } from "../../src/modules/presence/index.js";

const WINDOW_MS = 5 * 60_000;

const person = (userId: string, fields: Partial<PresencePerson> = {}): PresencePerson => ({
  userId,
  membershipId: `m-${userId}`,
  orgId: "org-1",
  role: "MANAGER",
  name: "Мария",
  image: null,
  clientIds: [],
  ...fields,
});

function registry(start = 0) {
  let now = start;
  const presence = createPresenceRegistry({ now: () => now, windowMs: WINDOW_MS });
  return { presence, pass: (ms: number) => { now += ms; } };
}

describe("the presence registry", () => {
  it("holds a person once they are known to be here", () => {
    const { presence } = registry();

    expect(presence.seen("u1")).toBe(false);
    presence.join(person("u1"));

    expect(presence.list().map((who) => who.userId)).toEqual(["u1"]);
    expect(presence.seen("u1")).toBe(true);
  });

  it("keeps one entry for a person working in several sessions", () => {
    const { presence } = registry();

    presence.join(person("u1"));
    presence.join(person("u1"));

    expect(presence.list()).toHaveLength(1);
  });

  it("stays online while any session keeps asking", () => {
    const { presence, pass } = registry();
    presence.join(person("u1"));

    pass(WINDOW_MS - 1_000);
    expect(presence.seen("u1")).toBe(true);
    pass(WINDOW_MS - 1_000);

    expect(presence.list()).toHaveLength(1);
    expect(presence.sweep()).toEqual([]);
  });

  it("lets go of a person who has been silent for the whole window", () => {
    const { presence, pass } = registry();
    presence.join(person("u1"));

    pass(WINDOW_MS + 1);

    expect(presence.seen("u1")).toBe(false);
    expect(presence.list()).toEqual([]);
  });

  it("names who left when it sweeps, and only once", () => {
    const { presence, pass } = registry();
    presence.join(person("u1"));
    presence.join(person("u2"));

    pass(WINDOW_MS - 1_000);
    presence.seen("u2");
    pass(2_000);

    expect(presence.sweep().map((who) => who.userId)).toEqual(["u1"]);
    expect(presence.sweep()).toEqual([]);
    expect(presence.list().map((who) => who.userId)).toEqual(["u2"]);
  });

  it("drops a person the moment they sign out", () => {
    const { presence } = registry();
    presence.join(person("u1"));

    expect(presence.leave("u1")?.userId).toBe("u1");

    expect(presence.list()).toEqual([]);
    expect(presence.leave("u1")).toBeNull();
  });
});
