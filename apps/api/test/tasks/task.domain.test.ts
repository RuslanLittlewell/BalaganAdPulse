import { describe, expect, it } from "vitest";
import {
  TASK_COLUMNS,
  TASK_PRIORITIES,
  DEFAULT_TASK_COLUMN,
  isTaskColumn,
  placeInColumn,
  reorderAfterRemoval,
} from "../../src/modules/tasks/domain/board.js";

describe("the board's columns", () => {
  it("are the six, in the order they are drawn", () => {
    expect(TASK_COLUMNS).toEqual([
      "IDEA", "ARCHIVED", "IN_PROGRESS", "NEEDS_FIX", "IN_REVIEW", "DONE",
    ]);
  });

  it("start a task in IDEA when none is named", () => {
    expect(DEFAULT_TASK_COLUMN).toBe("IDEA");
  });

  it("recognise their own members and nothing else", () => {
    for (const column of TASK_COLUMNS) expect(isTaskColumn(column)).toBe(true);
    expect(isTaskColumn("BACKLOG")).toBe(false);
    expect(isTaskColumn("")).toBe(false);
  });
});

describe("the priorities", () => {
  it("are a task's own scale, low to urgent", () => {
    expect(TASK_PRIORITIES).toEqual(["LOW", "MEDIUM", "HIGH", "URGENT"]);
  });
});

describe("placing a card in a column", () => {
  it("inserts it at the position asked for and shifts the rest down", () => {
    expect(placeInColumn(["a", "b", "c"], "x", 1)).toEqual(["a", "x", "b", "c"]);
  });

  it("puts it first at position zero", () => {
    expect(placeInColumn(["a", "b"], "x", 0)).toEqual(["x", "a", "b"]);
  });

  it("clamps a position past the end to last, rather than refusing the move", () => {
    expect(placeInColumn(["a", "b"], "x", 99)).toEqual(["a", "b", "x"]);
  });

  it("clamps a negative position to first", () => {
    expect(placeInColumn(["a", "b"], "x", -5)).toEqual(["x", "a", "b"]);
  });

  it("moves a card already in the column rather than duplicating it", () => {
    expect(placeInColumn(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
  });

  it("puts the only card of an empty column first", () => {
    expect(placeInColumn([], "x", 3)).toEqual(["x"]);
  });
});

describe("closing the gap a removed card leaves", () => {
  it("keeps the remaining order with no gap", () => {
    expect(reorderAfterRemoval(["a", "b", "c", "d"], "b")).toEqual(["a", "c", "d"]);
  });

  it("leaves a column that never held the card alone", () => {
    expect(reorderAfterRemoval(["a", "b"], "z")).toEqual(["a", "b"]);
  });
});
