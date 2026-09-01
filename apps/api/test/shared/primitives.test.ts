import { describe, expect, it } from "vitest";
import type { ActorContext } from "../../src/shared/application/actor-context.js";
import { FixedClock, SystemClock } from "../../src/shared/infrastructure/clock.js";
import { DeterministicIdGenerator, RandomIdGenerator } from "../../src/shared/infrastructure/id-generator.js";

describe("shared application primitives", () => {
  it("uses the access-policy role vocabulary for actor context", () => {
    const actor: ActorContext = { userId: "u1", membershipId: "m1", orgId: "o1", role: "MANAGER" };
    expect(actor.role).toBe("MANAGER");
  });

  it("provides fixed and system clocks", () => {
    const instant = new Date("2026-08-31T12:00:00.000Z");
    expect(new FixedClock(instant).now()).toEqual(instant);
    expect(Math.abs(new SystemClock().now().getTime() - Date.now())).toBeLessThan(100);
  });

  it("provides deterministic and random UUID generators", () => {
    const ids = new DeterministicIdGenerator(["first", "second"]);
    expect([ids.generate(), ids.generate()]).toEqual(["first", "second"]);
    expect(new RandomIdGenerator().generate()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
