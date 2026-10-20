import { mayBeCall, occurrencesBetween } from "@/entities/task/index.js";

const WEEK = ["2026-10-19", "2026-10-25"] as const;

describe("the days a task falls on within a week", () => {
  it("is every day for a daily task", () => {
    expect(occurrencesBetween({ dueDate: "2026-10-19", repeatEvery: "DAILY" }, ...WEEK)).toEqual([
      "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25",
    ]);
  });

  it("counts from a due date long past", () => {
    expect(occurrencesBetween({ dueDate: "2025-01-06", repeatEvery: "WEEKLY" }, ...WEEK)).toEqual(["2026-10-19"]);
  });

  it("skips the week a fortnightly task rests", () => {
    const fortnightly = { dueDate: "2026-10-14", repeatEvery: "BIWEEKLY" } as const;

    expect(occurrencesBetween(fortnightly, ...WEEK)).toEqual([]);
    expect(occurrencesBetween(fortnightly, "2026-10-26", "2026-11-01")).toEqual(["2026-10-28"]);
  });

  it("starts no earlier than the due date", () => {
    expect(occurrencesBetween({ dueDate: "2026-10-22", repeatEvery: "DAILY" }, ...WEEK))
      .toEqual(["2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
  });

  it("falls on the last day of a month too short for it, and back on its day after", () => {
    const monthly = { dueDate: "2026-01-31", repeatEvery: "MONTHLY" } as const;

    expect(occurrencesBetween(monthly, "2026-02-23", "2026-03-01")).toEqual(["2026-02-28"]);
    expect(occurrencesBetween(monthly, "2026-03-30", "2026-04-05")).toEqual(["2026-03-31"]);
  });

  it("is the due date alone for a task that does not repeat", () => {
    expect(occurrencesBetween({ dueDate: "2026-10-21", repeatEvery: "NONE" }, ...WEEK)).toEqual(["2026-10-21"]);
    expect(occurrencesBetween({ dueDate: "2026-10-28", repeatEvery: "NONE" }, ...WEEK)).toEqual([]);
  });

  it("is no day for a task with no due date", () => {
    expect(occurrencesBetween({ dueDate: null, repeatEvery: "NONE" }, ...WEEK)).toEqual([]);
  });
});

describe("what may be a call", () => {
  it("is a task with a time that repeats", () => {
    expect(mayBeCall({ dueTime: "10:00", repeatEvery: "WEEKLY" })).toBe(true);
    expect(mayBeCall({ dueTime: null, repeatEvery: "WEEKLY" })).toBe(false);
    expect(mayBeCall({ dueTime: "10:00", repeatEvery: "NONE" })).toBe(false);
  });
});
