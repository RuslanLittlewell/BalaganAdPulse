import {
  ALL_COLUMN_IDS, useColumnWidths, visibleColumnIds,
} from "@/widgets/performance-table/columnWidths.js";

describe("a table's layout copied for an account", () => {
  beforeEach(() => useColumnWidths.setState({
    nameWidths: {}, columnWidths: {}, columnOrder: {}, visibleColumns: {}, offeredColumns: {},
  }));

  it("starts as a copy of the plain table's layout", () => {
    useColumnWidths.setState({
      nameWidths: { campaigns: 200 },
      columnWidths: { campaigns: { spend: 90 } },
      visibleColumns: { campaigns: ["name", "spend", "clicks"] },
    });

    useColumnWidths.getState().inherit("campaigns:META:1", "campaigns");

    const state = useColumnWidths.getState();
    expect(state.nameWidths["campaigns:META:1"]).toBe(200);
    expect(state.columnWidths["campaigns:META:1"]).toEqual({ spend: 90 });
    expect(state.visibleColumns["campaigns:META:1"]).toEqual(["name", "spend", "clicks"]);
    expect(state.columnOrder["campaigns:META:1"]).toBeUndefined();
  });

  it("is a copy, so changing the account leaves the plain table as it was", () => {
    useColumnWidths.setState({ columnWidths: { campaigns: { spend: 90 } } });
    useColumnWidths.getState().inherit("campaigns:META:1", "campaigns");

    useColumnWidths.getState().setColumnWidth("campaigns:META:1", "spend", 150);

    expect(useColumnWidths.getState().columnWidths.campaigns).toEqual({ spend: 90 });
  });

  it("is not copied again over an account's own layout", () => {
    useColumnWidths.setState({
      columnWidths: { campaigns: { spend: 90 }, "campaigns:META:1": { spend: 150 } },
    });

    useColumnWidths.getState().inherit("campaigns:META:1", "campaigns");

    expect(useColumnWidths.getState().columnWidths["campaigns:META:1"]).toEqual({ spend: 150 });
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
