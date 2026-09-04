import { applyMove, placementFor, resolveDrop, type Task } from "@/entities/task/index.js";

const task = (id: string, column: Task["column"], position: number): Task => ({
  id, projectId: "p1", orgId: "org1", title: id, description: null,
  column, priority: "LOW", assigneeId: null, createdById: null, campaignId: null, visibleToClient: false,
  position, imageIds: [],
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
});

/** The arithmetic the board applies before the server answers. It has to match
 * what the server does, or the card jumps when the response lands. */
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

/** Where a drag would land, given whatever it is hovering over. The board uses
 * it twice: to preview the gap while dragging, and to commit on drop — so the
 * placeholder and the saved position cannot disagree. */
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
    // "c" over "a": the active card is excluded first, so slot 0 is "a"'s.
    expect(placementFor(board, "c", "a")).toEqual({ column: "IDEA", position: 0 });
  });

  it("lands below the card it was dragged down onto", () => {
    // Dragging "a" down onto "c" should leave [b, c, a] — the index is read
    // from the column as it stands, which is what the server then splices to.
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
    // The bug this replaces: counting slots without the dragged card made
    // "drag down onto the next card" resolve to the position it already had.
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

/** What a drop should save. The board prefers what the preview is showing, but
 * must still work when the preview never moved — otherwise a drag that the
 * pointer tracked correctly is silently discarded. */
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
    // The preview is untouched — the case where mid-drag measurement failed.
    expect(resolveDrop(server, server, "a", "DONE")).toEqual({ column: "DONE", position: 1 });
  });

  it("falls back with no preview at all", () => {
    expect(resolveDrop(server, null, "a", "x")).toEqual({ column: "DONE", position: 0 });
  });

  it("answers nothing when the card would not actually move", () => {
    // Dropped back onto itself.
    expect(resolveDrop(server, server, "a", "a")).toBeNull();
    // Already last in its column, dropped on that column's empty space.
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

/**
 * Identity matters here, not just contents.
 *
 * The board writes the result of every drag-over into state. React re-renders
 * whenever that state changes identity, and dnd-kit re-measures its droppables
 * on every render while a drag is in flight — which fires another drag-over. A
 * result that is a new array each time closes that circle into an infinite
 * loop, and React aborts the page with "Maximum update depth exceeded".
 */
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
    // "c" is pushed down by the arrival, so it is rebuilt; "b" closes the gap
    // "a" left behind, so it is rebuilt too. Both genuinely changed.
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
