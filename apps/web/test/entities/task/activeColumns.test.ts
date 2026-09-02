import { ACTIVE_TASK_COLUMNS, TASK_COLUMNS, isActiveColumn } from "@/entities/task/index.js";

/**
 * In flight is the complement of the two terminal stages, not a list of four.
 * A stage added later is in flight by default — a new stage turning up in the
 * list gets noticed; one silently missing from it does not.
 */
describe("the stages work is in flight at", () => {
  it("is every stage except done and archived", () => {
    expect(ACTIVE_TASK_COLUMNS).toEqual(["IDEA", "IN_PROGRESS", "NEEDS_FIX", "IN_REVIEW"]);
  });

  it("covers every column the board draws, between it and the terminal two", () => {
    const terminal = TASK_COLUMNS.filter((column) => !isActiveColumn(column));

    expect(terminal).toEqual(["DONE", "ARCHIVED"]);
    expect([...ACTIVE_TASK_COLUMNS, ...terminal].sort()).toEqual([...TASK_COLUMNS].sort());
  });

  it("answers for one column", () => {
    expect(isActiveColumn("IN_REVIEW")).toBe(true);
    expect(isActiveColumn("DONE")).toBe(false);
    expect(isActiveColumn("ARCHIVED")).toBe(false);
  });
});
