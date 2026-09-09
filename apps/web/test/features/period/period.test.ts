import { defaultRange, isDateRange, isIsoDate } from "@/features/period/index.js";

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
