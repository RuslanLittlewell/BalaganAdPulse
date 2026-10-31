import {
  chosenTiles,
  dragStarted,
  draggedOver,
  movedTo,
  sameOrder,
  toggledTiles,
} from "@/widgets/agency-overview/summaryTiles.js";

describe("the summary's order", () => {
  it("keeps the stored order, without tiles the screen does not offer", () => {
    expect(chosenTiles(["CPC", "KPI", "SPEND"], ["SPEND", "CPC"])).toEqual(["CPC", "SPEND"]);
  });

  it("puts a newly chosen tile last", () => {
    expect(toggledTiles(["CPC", "SPEND"], "CLICKS", ["SPEND", "CLICKS", "CPC"])).toEqual(["CPC", "SPEND", "CLICKS"]);
  });

  it("moves a tile to a place among the others, and nowhere past either end", () => {
    expect(movedTo(["SPEND", "CLICKS", "CPC"], "CPC", 0)).toEqual(["CPC", "SPEND", "CLICKS"]);
    expect(movedTo(["SPEND", "CLICKS", "CPC"], "SPEND", 2)).toEqual(["CLICKS", "CPC", "SPEND"]);
    expect(movedTo(["SPEND", "CLICKS"], "SPEND", -1)).toEqual(["SPEND", "CLICKS"]);
    expect(movedTo(["SPEND", "CLICKS"], "CLICKS", 2)).toEqual(["SPEND", "CLICKS"]);
    expect(movedTo(["SPEND", "CLICKS"], "CPC", 0)).toEqual(["SPEND", "CLICKS"]);
  });

  it("tells orders apart", () => {
    expect(sameOrder(["SPEND", "CPC"], ["SPEND", "CPC"])).toBe(true);
    expect(sameOrder(["SPEND", "CPC"], ["CPC", "SPEND"])).toBe(false);
    expect(sameOrder(["SPEND"], ["SPEND", "CPC"])).toBe(false);
  });
});

describe("dragging a tile", () => {
  it("takes the place of the tile it reaches", () => {
    const drag = draggedOver(dragStarted(["SPEND", "KPI", "CPC"], "SPEND"), "KPI");

    expect(drag.order).toEqual(["KPI", "SPEND", "CPC"]);
  });

  it("stays put while it is still over the tile it just passed, so a wide tile cannot swap it back and forth", () => {
    const passed = draggedOver(dragStarted(["SPEND", "KPI", "CPC"], "SPEND"), "KPI");

    expect(draggedOver(passed, "KPI")).toBe(passed);
    expect(draggedOver(passed, null)).toBe(passed);
  });

  it("goes back past a tile once it has been over its own place in between", () => {
    const passed = draggedOver(dragStarted(["SPEND", "KPI", "CPC"], "SPEND"), "KPI");
    const back = draggedOver(draggedOver(passed, "SPEND"), "KPI");

    expect(back.order).toEqual(["SPEND", "KPI", "CPC"]);
  });

  it("moves on to the next tile it reaches", () => {
    const passed = draggedOver(dragStarted(["SPEND", "KPI", "CPC"], "SPEND"), "KPI");

    expect(draggedOver(passed, "CPC").order).toEqual(["KPI", "CPC", "SPEND"]);
  });
});
