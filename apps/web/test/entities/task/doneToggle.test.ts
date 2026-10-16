import { doneToggleFor, isDone, nextOccurrence } from "@/entities/task/index.js";

describe("what ticking Готово does", () => {
  it("closes a task that does not repeat into the top of Готово", () => {
    expect(doneToggleFor({ column: "IN_REVIEW", repeatEvery: "NONE" }))
      .toEqual({ kind: "move", move: { column: "DONE", position: 0 } });
  });

  it("reopens a task in Готово into the top of В работе", () => {
    expect(doneToggleFor({ column: "DONE", repeatEvery: "NONE" }))
      .toEqual({ kind: "move", move: { column: "IN_PROGRESS", position: 0 } });
  });

  it("completes a repeating task into its next occurrence", () => {
    expect(doneToggleFor({ column: "IN_PROGRESS", repeatEvery: "WEEKLY" })).toEqual({ kind: "complete" });
  });

  it("reopens a repeating task that sits in Готово", () => {
    expect(doneToggleFor({ column: "DONE", repeatEvery: "WEEKLY" }))
      .toEqual({ kind: "move", move: { column: "IN_PROGRESS", position: 0 } });
  });

  it("counts a task as done exactly when it is in Готово", () => {
    expect(isDone({ column: "DONE" })).toBe(true);
    expect(isDone({ column: "IN_REVIEW" })).toBe(false);
  });
});

describe("the next occurrence", () => {
  it.each([
    ["2026-09-16", "DAILY", "2026-09-17"],
    ["2026-09-16", "WEEKLY", "2026-09-23"],
    ["2026-09-16", "BIWEEKLY", "2026-09-30"],
    ["2026-09-16", "MONTHLY", "2026-10-16"],
    ["2026-01-31", "MONTHLY", "2026-02-28"],
    ["2028-01-31", "MONTHLY", "2028-02-29"],
    ["2026-12-15", "MONTHLY", "2027-01-15"],
    ["2026-12-29", "WEEKLY", "2027-01-05"],
  ] as const)("from %s every %s is %s", (day, repeat, next) => {
    expect(nextOccurrence(day, repeat)).toBe(next);
  });
});
