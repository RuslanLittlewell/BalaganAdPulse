import { applyLeadMove, LEAD_STAGES, leadPlacementFor, leadPreviewFor, type Lead } from "@/entities/lead/index.js";

const lead = (id: string, stage: Lead["stage"], position: number): Lead => ({
  id, orgId: "org-1", name: id, company: null, phone: null, email: null,
  website: null, source: null, notes: null, amount: null, service: null, telegram: null, messenger: null, tags: [], projectId: "project-1", campaignId: null, adId: null,
  assigneeId: null, project: { id: "project-1", clientId: "client-1", name: "Летний запуск" }, assignee: null,
  origin: "MANUAL", ad: null, metaSource: null, stage, position,
  createdAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z",
});

const order = (board: Lead[], stage: Lead["stage"]) =>
  board.filter((row) => row.stage === stage).sort((a, b) => a.position - b.position).map((row) => row.id);

describe("applyLeadMove", () => {
  const board = [
    lead("a", "NEW", 0), lead("b", "NEW", 1), lead("c", "NEW", 2),
    lead("x", "PROPOSAL", 0), lead("y", "PROPOSAL", 1),
  ];

  it("moves a lead into another stage and renumbers both densely", () => {
    const after = applyLeadMove(board, "a", { stage: "PROPOSAL", position: 1 });
    expect(order(after, "NEW")).toEqual(["b", "c"]);
    expect(order(after, "PROPOSAL")).toEqual(["x", "a", "y"]);
  });

  it("reorders within one stage", () => {
    expect(order(applyLeadMove(board, "c", { stage: "NEW", position: 0 }), "NEW")).toEqual(["c", "a", "b"]);
  });

  it("appends when the position runs past the end", () => {
    expect(order(applyLeadMove(board, "a", { stage: "PROPOSAL", position: 99 }), "PROPOSAL")).toEqual(["x", "y", "a"]);
  });

  it("answers the very array it was given when nothing would change", () => {
    expect(applyLeadMove(board, "a", { stage: "NEW", position: 0 })).toBe(board);
    expect(applyLeadMove(board, "missing", { stage: "PROPOSAL", position: 0 })).toBe(board);
  });

  it("leaves untouched stages alone, object for object", () => {
    const wide = [...board, lead("z", "TARGET", 0)];
    const after = applyLeadMove(wide, "a", { stage: "PROPOSAL", position: 0 });
    expect(after.find((row) => row.id === "z")).toBe(wide.find((row) => row.id === "z"));
  });
});

describe("leadPlacementFor", () => {
  const board = [
    lead("a", "NEW", 0), lead("b", "NEW", 1), lead("c", "NEW", 2),
    lead("x", "PROPOSAL", 0),
  ];

  it("drops into a custom column of the board", () => {
    const stages = [...LEAD_STAGES, "col-1"];
    expect(leadPlacementFor(board, "a", "col-1", stages)).toEqual({ stage: "col-1", position: 0 });
    expect(leadPlacementFor([...board, lead("m", "col-1", 0)], "a", "m", stages)).toEqual({ stage: "col-1", position: 0 });
  });

  it("answers nothing for a column the board does not have", () => {
    expect(leadPlacementFor(board, "a", "col-1")).toBeNull();
  });

  it("drops at the end of an empty stage", () => {
    expect(leadPlacementFor(board, "a", "TARGET")).toEqual({ stage: "TARGET", position: 0 });
  });

  it("drops after the last card of a stage that holds some", () => {
    expect(leadPlacementFor(board, "a", "PROPOSAL")).toEqual({ stage: "PROPOSAL", position: 1 });
  });

  it("takes the slot of the card it hovers", () => {
    expect(leadPlacementFor(board, "a", "x")).toEqual({ stage: "PROPOSAL", position: 0 });
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
    const board = [...stage, lead("x", "PROPOSAL", 0)];
    const entered = leadPreviewFor(board, "a", "x");
    expect(entered).not.toBe(board);
    expect(entered.find((row) => row.id === "a")).toMatchObject({ stage: "PROPOSAL", position: 0 });
    expect(leadPreviewFor(entered, "a", "x")).toBe(entered);
  });
});
