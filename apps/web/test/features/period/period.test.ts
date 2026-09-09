import { SHORTCUTS, defaultRange, isDateRange, isIsoDate, shortcutRange } from "@/features/period/index.js";

const TODAY = "2026-08-17";

describe("custom date range", () => {
  it("defaults to the last thirty days including today", () => {
    expect(defaultRange(TODAY)).toEqual({ from: "2026-07-19", to: "2026-08-17" });
  });

  it("accepts real ISO calendar dates only", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("17.08.2026")).toBe(false);
    expect(isIsoDate("2026-8-17")).toBe(false);
  });

  it("requires the start to be no later than the end", () => {
    expect(isDateRange({ from: "2026-08-01", to: "2026-08-17" })).toBe(true);
    expect(isDateRange({ from: "2026-08-17", to: "2026-08-17" })).toBe(true);
    expect(isDateRange({ from: "2026-08-18", to: "2026-08-17" })).toBe(false);
  });
});

describe("range shortcuts", () => {
  it("offers seven days, this month and the previous month in that order", () => {
    expect(SHORTCUTS).toEqual(["7d", "month", "prevMonth"]);
  });

  it("ends the seven-day and current-month shortcuts on today", () => {
    expect(shortcutRange("7d", TODAY)).toEqual({ from: "2026-08-11", to: "2026-08-17" });
    expect(shortcutRange("month", TODAY)).toEqual({ from: "2026-08-01", to: "2026-08-17" });
  });

  it("covers the whole previous calendar month", () => {
    expect(shortcutRange("prevMonth", TODAY)).toEqual({ from: "2026-07-01", to: "2026-07-31" });
    expect(shortcutRange("prevMonth", "2026-01-09")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });
});
