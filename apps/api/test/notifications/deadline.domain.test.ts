import { describe, expect, it } from "vitest";
import { deadlineOf, isDueSoon } from "../../src/modules/notifications/index.js";

describe("a task's deadline", () => {
  it("is its due date at its due time in the agency's zone", () => {
    expect(deadlineOf("2026-10-20", "18:00", "Europe/Minsk")).toEqual(new Date("2026-10-20T15:00:00Z"));
  });

  it("is the end of its due date when it has no time", () => {
    expect(deadlineOf("2026-10-20", null, "Europe/Minsk")).toEqual(new Date("2026-10-20T21:00:00Z"));
  });

  it("follows a zone across its change of clocks", () => {
    expect(deadlineOf("2026-10-24", "12:00", "Europe/Berlin")).toEqual(new Date("2026-10-24T10:00:00Z"));
    expect(deadlineOf("2026-10-26", "12:00", "Europe/Berlin")).toEqual(new Date("2026-10-26T11:00:00Z"));
  });

  it("is due soon within the day before it and not after it has passed", () => {
    const deadline = new Date("2026-10-20T15:00:00Z");

    expect(isDueSoon(deadline, new Date("2026-10-19T14:59:00Z"))).toBe(false);
    expect(isDueSoon(deadline, new Date("2026-10-19T15:00:00Z"))).toBe(true);
    expect(isDueSoon(deadline, new Date("2026-10-20T14:59:00Z"))).toBe(true);
    expect(isDueSoon(deadline, new Date("2026-10-20T15:00:00Z"))).toBe(false);
  });
});
