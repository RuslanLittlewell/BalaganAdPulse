import { aLead } from "@test/shared/fixtures.js";
import { boardPlacement } from "@/widgets/crm-board/boardPlacement.js";

const at = (id: string, stage: string, position: number) => aLead({ id, stage, position });

const all = [
  at("a", "NEW", 0), at("b", "NEW", 1), at("c", "NEW", 2), at("d", "NEW", 3),
  at("x", "TARGET", 0), at("y", "TARGET", 1),
];

describe("placing a drop on the stored board", () => {
  it("passes a drop through unchanged when nothing is hidden", () => {
    expect(boardPlacement("x", { stage: "NEW", position: 1 }, { all, shown: all, sorted: false })).toEqual({ stage: "NEW", position: 1 });
  });

  it("puts the lead just before the shown card it was dropped above", () => {
    const shown = all.filter((lead) => lead.id !== "b" && lead.id !== "c");
    expect(boardPlacement("x", { stage: "NEW", position: 1 }, { all, shown, sorted: false })).toEqual({ stage: "NEW", position: 3 });
  });

  it("puts the lead after the last shown card when dropped at the end", () => {
    const shown = all.filter((lead) => lead.id !== "d");
    expect(boardPlacement("x", { stage: "NEW", position: 3 }, { all, shown, sorted: false })).toEqual({ stage: "NEW", position: 3 });
  });

  it("appends to a column whose leads are all hidden", () => {
    const shown = all.filter((lead) => lead.stage !== "NEW");
    expect(boardPlacement("x", { stage: "NEW", position: 0 }, { all, shown, sorted: false })).toEqual({ stage: "NEW", position: 4 });
  });

  it("ignores a drop that leaves the lead where it was", () => {
    const shown = all.filter((lead) => lead.id !== "b");
    expect(boardPlacement("c", { stage: "NEW", position: 1 }, { all, shown, sorted: false })).toBeNull();
  });

  it("refuses to reorder within a column while sorted", () => {
    expect(boardPlacement("a", { stage: "NEW", position: 2 }, { all, shown: all, sorted: true })).toBeNull();
  });

  it("moves to the end of another column while sorted", () => {
    expect(boardPlacement("a", { stage: "TARGET", position: 0 }, { all, shown: all, sorted: true })).toEqual({ stage: "TARGET", position: 2 });
  });
});
