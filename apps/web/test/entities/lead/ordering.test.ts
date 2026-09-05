import { applyLeadMove, leadPlacementFor, leadPreviewFor, type Lead } from "@/entities/lead/index.js";

const lead = (id: string, stage: Lead["stage"], position: number): Lead => ({
  id, orgId: "org-1", clientId: null, name: id, company: null, phone: null, email: null,
  website: null, source: null, notes: null, projectId: null, campaignId: null, stage, position,
  createdAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z",
});

const order = (board: Lead[], stage: Lead["stage"]) =>
  board.filter((row) => row.stage === stage).sort((a, b) => a.position - b.position).map((row) => row.id);

describe("applyLeadMove", () => {
  const board = [
    lead("a", "NEW", 0), lead("b", "NEW", 1), lead("c", "NEW", 2),
    lead("x", "WON", 0), lead("y", "WON", 1),
  ];

  it("moves a lead into another stage and renumbers both densely", () => {
    const after = applyLeadMove(board, "a", { stage: "WON", position: 1 });
    expect(order(after, "NEW")).toEqual(["b", "c"]);
    expect(order(after, "WON")).toEqual(["x", "a", "y"]);
  });

  it("reorders within one stage", () => {
    expect(order(applyLeadMove(board, "c", { stage: "NEW", position: 0 }), "NEW")).toEqual(["c", "a", "b"]);
  });

  it("appends when the position runs past the end", () => {
    expect(order(applyLeadMove(board, "a", { stage: "WON", position: 99 }), "WON")).toEqual(["x", "y", "a"]);
  });

  it("answers the very array it was given when nothing would change", () => {
    expect(applyLeadMove(board, "a", { stage: "NEW", position: 0 })).toBe(board);
    expect(applyLeadMove(board, "missing", { stage: "WON", position: 0 })).toBe(board);
  });

  it("leaves untouched stages alone, object for object", () => {
    const wide = [...board, lead("z", "LOST", 0)];
    const after = applyLeadMove(wide, "a", { stage: "WON", position: 0 });
    expect(after.find((row) => row.id === "z")).toBe(wide.find((row) => row.id === "z"));
  });
});

describe("leadPlacementFor", () => {
  const board = [
    lead("a", "NEW", 0), lead("b", "NEW", 1), lead("c", "NEW", 2),
    lead("x", "WON", 0),
  ];

  it("drops at the end of an empty stage", () => {
    expect(leadPlacementFor(board, "a", "LOST")).toEqual({ stage: "LOST", position: 0 });
  });

  it("drops after the last card of a stage that holds some", () => {
    expect(leadPlacementFor(board, "a", "WON")).toEqual({ stage: "WON", position: 1 });
  });

  it("takes the slot of the card it hovers", () => {
    expect(leadPlacementFor(board, "a", "x")).toEqual({ stage: "WON", position: 0 });
    expect(leadPlacementFor(board, "c", "a")).toEqual({ stage: "NEW", position: 0 });
  });

  it("answers nothing when either card is unknown", () => {
    expect(leadPlacementFor(board, "missing", "a")).toBeNull();
    expect(leadPlacementFor(board, "a", "missing")).toBeNull();
  });
});

describe("leadPreviewFor", () => {
  const stage = [lead("a", "NEW", 0), lead("b", "NEW", 1), lead("c", "NEW", 2)];

  it("settles instead of swapping two cards forever while the pointer rests on one", () => {
    let board: Lead[] = stage;
    for (let pass = 0; pass < 8; pass += 1) {
      const next = leadPreviewFor(board, "a", "b");
      if (next === board) break;
      board = next;
    }
    expect(leadPreviewFor(board, "a", "b")).toBe(board);
  });

  it("shows no preview while a card is dragged over its own stage", () => {
    expect(leadPreviewFor(stage, "a", "b")).toBe(stage);
    expect(leadPreviewFor(stage, "a", "NEW")).toBe(stage);
  });

  it("moves the card once as it crosses into another stage, then settles there", () => {
    const board = [...stage, lead("x", "WON", 0)];
    const entered = leadPreviewFor(board, "a", "x");
    expect(entered).not.toBe(board);
    expect(entered.find((row) => row.id === "a")).toMatchObject({ stage: "WON", position: 0 });
    expect(leadPreviewFor(entered, "a", "x")).toBe(entered);
  });
});
