import { applyMove, placementFor, previewFor, resolveDrop, type Task } from "@/entities/task/index.js";

const task = (id: string, column: Task["column"], position: number): Task => ({
  id, projectId: "p1", orgId: "org1", title: id, description: null,
  column, priority: "LOW", assigneeId: null, createdById: null, campaignId: null, visibleToClient: false,
  position, imageIds: [],
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
});

describe("applyMove", () => {
  it("moves a card into another column and renumbers both densely", () => {
    const board = [
      task("a", "IDEA", 0), task("b", "IDEA", 1),
      task("x", "DONE", 0), task("y", "DONE", 1),
    ];
    const after = new Map(applyMove(board, "a", { column: "DONE", position: 1 }).map((t) => [t.id, t]));

    expect(after.get("b")).toMatchObject({ column: "IDEA", position: 0 });
    expect(after.get("x")).toMatchObject({ column: "DONE", position: 0 });
    expect(after.get("a")).toMatchObject({ column: "DONE", position: 1 });
    expect(after.get("y")).toMatchObject({ column: "DONE", position: 2 });
  });

  it("reorders within one column", () => {
    const board = [task("a", "IDEA", 0), task("b", "IDEA", 1), task("c", "IDEA", 2)];
    const after = applyMove(board, "c", { column: "IDEA", position: 0 })
      .sort((l, r) => l.position - r.position);
    expect(after.map((t) => t.id)).toEqual(["c", "a", "b"]);
  });

  it("clamps a position past the end of the target column", () => {
    const board = [task("a", "IDEA", 0), task("x", "DONE", 0)];
    const after = new Map(applyMove(board, "a", { column: "DONE", position: 99 }).map((t) => [t.id, t]));
    expect(after.get("a")).toMatchObject({ column: "DONE", position: 1 });
  });

  it("leaves the board alone when the card is unknown", () => {
    const board = [task("a", "IDEA", 0)];
    expect(applyMove(board, "missing", { column: "DONE", position: 0 })).toBe(board);
  });

  it("leaves other columns untouched", () => {
    const board = [task("a", "IDEA", 0), task("z", "IN_REVIEW", 0)];
    const after = applyMove(board, "a", { column: "DONE", position: 0 });
    expect(after.find((t) => t.id === "z")).toMatchObject({ column: "IN_REVIEW", position: 0 });
  });
});

describe("placementFor", () => {
  const board = [
    task("a", "IDEA", 0), task("b", "IDEA", 1), task("c", "IDEA", 2),
    task("x", "DONE", 0), task("y", "DONE", 1),
  ];

  it("drops at the end when hovering an empty column", () => {
    expect(placementFor(board, "a", "IN_REVIEW")).toEqual({ column: "IN_REVIEW", position: 0 });
  });

  it("drops after the last card when hovering a column that holds some", () => {
    expect(placementFor(board, "a", "DONE")).toEqual({ column: "DONE", position: 2 });
  });

  it("takes the slot of the card it is hovering, in another column", () => {
    expect(placementFor(board, "a", "y")).toEqual({ column: "DONE", position: 1 });
  });

  it("takes the slot of the card it is hovering, within its own column", () => {
    expect(placementFor(board, "c", "a")).toEqual({ column: "IDEA", position: 0 });
  });

  it("lands below the card it was dragged down onto", () => {
    expect(placementFor(board, "a", "c")).toEqual({ column: "IDEA", position: 2 });
    const after = applyMove(board, "a", placementFor(board, "a", "c")!)
      .filter((t) => t.column === "IDEA")
      .sort((l, r) => l.position - r.position);
    expect(after.map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("lands above the card it was dragged up onto", () => {
    const after = applyMove(board, "c", placementFor(board, "c", "a")!)
      .filter((t) => t.column === "IDEA")
      .sort((l, r) => l.position - r.position);
    expect(after.map((t) => t.id)).toEqual(["c", "a", "b"]);
  });

  it("is never a no-op for a real move within a column", () => {
    const placement = placementFor(board, "a", "b")!;
    expect(placement).not.toEqual({ column: "IDEA", position: 0 });
  });

  it("answers nothing when either card is unknown", () => {
    expect(placementFor(board, "missing", "a")).toBeNull();
    expect(placementFor(board, "a", "missing")).toBeNull();
  });

  it("is the same answer the optimistic move then applies", () => {
    const placement = placementFor(board, "a", "y")!;
    const after = new Map(applyMove(board, "a", placement).map((t) => [t.id, t]));
    expect(after.get("a")).toMatchObject({ column: "DONE", position: 1 });
  });
});

describe("resolveDrop", () => {
  const server = [
    task("a", "IDEA", 0), task("b", "IDEA", 1),
    task("x", "DONE", 0),
  ];

  it("saves what the preview is showing", () => {
    const preview = applyMove(server, "a", { column: "DONE", position: 0 });
    expect(resolveDrop(server, preview, "a", "x")).toEqual({ column: "DONE", position: 0 });
  });

  it("falls back to the drop target when the preview never moved the card", () => {
    expect(resolveDrop(server, server, "a", "DONE")).toEqual({ column: "DONE", position: 1 });
  });

  it("falls back with no preview at all", () => {
    expect(resolveDrop(server, null, "a", "x")).toEqual({ column: "DONE", position: 0 });
  });

  it("answers nothing when the card would not actually move", () => {
    expect(resolveDrop(server, server, "a", "a")).toBeNull();
    expect(resolveDrop(server, null, "b", "IDEA")).toBeNull();
  });

  it("treats a drop on its own column's empty space as a move to the end", () => {
    expect(resolveDrop(server, null, "a", "IDEA")).toEqual({ column: "IDEA", position: 1 });
  });

  it("answers nothing when the drop landed on nothing", () => {
    expect(resolveDrop(server, null, "a", null)).toBeNull();
  });

  it("answers nothing for a card it does not know", () => {
    expect(resolveDrop(server, null, "missing", "DONE")).toBeNull();
  });
});

describe("what applyMove leaves alone", () => {
  const board = [
    task("a", "IDEA", 0),
    task("b", "IDEA", 1),
    task("c", "DONE", 0),
  ];

  it("answers the very array it was given when the move changes nothing", () => {
    expect(applyMove(board, "a", { column: "IDEA", position: 0 })).toBe(board);
  });

  it("answers the same array when a position past the end clamps back to where it is", () => {
    expect(applyMove(board, "c", { column: "DONE", position: 9 })).toBe(board);
  });

  it("keeps every card that did not move as the same object", () => {
    const moved = applyMove(board, "a", { column: "DONE", position: 0 });

    expect(moved).not.toBe(board);
    expect(moved.find((t) => t.id === "a")).toMatchObject({ column: "DONE", position: 0 });
    expect(moved.find((t) => t.id === "b")).toMatchObject({ column: "IDEA", position: 0 });
    expect(moved.find((t) => t.id === "c")).toMatchObject({ column: "DONE", position: 1 });
  });

  it("keeps a card in an untouched column as the same object", () => {
    const wide = [...board, task("d", "IN_REVIEW", 0)];
    const moved = applyMove(wide, "a", { column: "IDEA", position: 1 });

    expect(moved).not.toBe(wide);
    expect(moved.find((t) => t.id === "d")).toBe(wide.find((t) => t.id === "d"));
  });

  it("answers the array it was given for a card it does not know", () => {
    expect(applyMove(board, "missing", { column: "DONE", position: 0 })).toBe(board);
  });
});

describe("previewFor", () => {
  const column = [task("a", "IDEA", 0), task("b", "IDEA", 1), task("c", "IDEA", 2)];

  it("settles instead of swapping two cards forever while the pointer rests on one", () => {
    let board: Task[] = column;
    for (let pass = 0; pass < 8; pass += 1) {
      const next = previewFor(board, "a", "b");
      if (next === board) break;
      board = next;
    }
    expect(previewFor(board, "a", "b")).toBe(board);
  });

  it("shows no preview while a card is dragged over its own column", () => {
    expect(previewFor(column, "a", "b")).toBe(column);
    expect(previewFor(column, "c", "a")).toBe(column);
    expect(previewFor(column, "a", "IDEA")).toBe(column);
  });

  it("moves the card once as it crosses into another column, then settles there", () => {
    const board = [...column, task("x", "DONE", 0), task("y", "DONE", 1)];

    const entered = previewFor(board, "a", "x");
    expect(entered).not.toBe(board);
    expect(entered.find((t) => t.id === "a")).toMatchObject({ column: "DONE", position: 0 });

    expect(previewFor(entered, "a", "x")).toBe(entered);
    expect(previewFor(entered, "a", "y")).toBe(entered);
  });

  it("previews the way back to the column the card came from", () => {
    const board = [...column, task("x", "DONE", 0)];
    const away = previewFor(board, "a", "x");
    expect(previewFor(away, "a", "b").find((t) => t.id === "a")).toMatchObject({ column: "IDEA" });
  });

  it("leaves the board alone when either card is unknown", () => {
    expect(previewFor(column, "missing", "b")).toBe(column);
    expect(previewFor(column, "a", "missing")).toBe(column);
  });
});
