import {
  ALL_COLUMN_IDS, fitWidths, MIN_COLUMN_WIDTH, useColumnWidths, visibleColumnIds,
} from "@/widgets/performance-table/columnWidths.js";

describe("fitWidths", () => {
  it("keeps the wanted widths when they fit, and when the room is unknown", () => {
    expect(fitWidths([128, 128], 300)).toEqual([128, 128]);
    expect(fitWidths([128, 128], 256)).toEqual([128, 128]);
    expect(fitWidths([128, 128], 0)).toEqual([128, 128]);
  });

  it("narrows every column in proportion until the columns fit", () => {
    const fitted = fitWidths([200, 100, 100], 300);
    expect(fitted).toEqual([150, 75, 75]);
    expect(fitted.reduce((sum, width) => sum + width, 0)).toBeLessThanOrEqual(300);
  });

  it("never narrows a column below the minimum", () => {
    expect(fitWidths([128, 128, 128], 150)).toEqual([MIN_COLUMN_WIDTH, MIN_COLUMN_WIDTH, MIN_COLUMN_WIDTH]);
  });
});

describe("the columns a member sees", () => {
  beforeEach(() => useColumnWidths.setState({ visibleColumns: {}, offeredColumns: {} }));

  it("are every column and the extra ones shown by default, before any choice", () => {
    expect(visibleColumnIds(undefined, ["kpi", "results.MESSAGES"], ["results.MESSAGES"]))
      .toEqual([...ALL_COLUMN_IDS, "results.MESSAGES"]);
  });

  it("keep a choice and add an extra column offered for the first time", () => {
    const chosen = ["name", "spend", "kpi"];
    const offered = [...ALL_COLUMN_IDS, "kpi"];

    expect(visibleColumnIds(chosen, ["kpi", "results.MESSAGES"], ["kpi", "results.MESSAGES"], offered))
      .toEqual(["name", "spend", "kpi", "results.MESSAGES"]);
  });

  it("do not bring back an extra column the member hid", () => {
    const chosen = ["name", "spend"];
    const offered = [...ALL_COLUMN_IDS, "kpi", "results.MESSAGES"];

    expect(visibleColumnIds(chosen, ["kpi", "results.MESSAGES"], ["kpi", "results.MESSAGES"], offered))
      .toEqual(["name", "spend"]);
  });

  it("remember what was offered when the member changes a column", () => {
    const extra = ["results.MESSAGES"];
    useColumnWidths.getState().toggleColumn("campaigns", "spend", extra, extra);
    useColumnWidths.getState().toggleColumn("campaigns", "results.MESSAGES", extra, extra);

    const state = useColumnWidths.getState();
    expect(state.offeredColumns.campaigns).toEqual([...ALL_COLUMN_IDS, "results.MESSAGES"]);
    expect(visibleColumnIds(state.visibleColumns.campaigns, extra, extra, state.offeredColumns.campaigns))
      .not.toContain("results.MESSAGES");
  });
});
