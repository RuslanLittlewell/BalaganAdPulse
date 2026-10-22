import { describe, expect, it } from "vitest";
import { isKpiGreen, kpiPercent, monthToDate, targetForRange } from "../../src/modules/kpi/index.js";

const SEPTEMBER = { from: "2026-09-01", to: "2026-09-30" };

const figures = {
  spend: 1000, impressions: 100000, reach: 40000, clicks: 2000, conversions: 30, results: 50, revenue: 4000,
  ctr: 2, cpc: 0.5, cpm: 10, cpa: 10, costPerResult: 20, roas: 4, frequency: 2.5,
};

describe("a KPI's target for a period", () => {
  it("is the monthly amount over a whole month", () => {
    expect(targetForRange("CONVERSIONS", 60, SEPTEMBER)).toBeCloseTo(60);
  });

  it("is prorated over a week", () => {
    expect(targetForRange("CONVERSIONS", 60, { from: "2026-09-01", to: "2026-09-07" })).toBeCloseTo(14);
  });

  it("prorates each day by its own month", () => {
    expect(targetForRange("CONVERSIONS", 60, { from: "2026-08-31", to: "2026-09-01" })).toBeCloseTo(60 / 31 + 60 / 30);
  });

  it("is the target as it is for a ratio", () => {
    expect(targetForRange("CPA", 20, { from: "2026-09-01", to: "2026-09-07" })).toBe(20);
  });
});

describe("a KPI's progress", () => {
  it("is the figure over the prorated target", () => {
    expect(kpiPercent({ metric: "CONVERSIONS", target: "60.0000" }, { ...figures, conversions: 45 }, {
      from: "2026-09-01", to: "2026-09-15",
    })).toBeCloseTo(150);
  });

  it("counts a lower-is-better metric in its favourable direction", () => {
    expect(kpiPercent({ metric: "CPA", target: "10.0000" }, { ...figures, cpa: 12 }, SEPTEMBER)).toBeCloseTo(83.33, 1);
  });

  it("has no percent for a figure that is not measured", () => {
    expect(kpiPercent({ metric: "CPA", target: "10.0000" }, { ...figures, cpa: null }, SEPTEMBER)).toBeNull();
  });

  it("compares a KPI set by hand as it is, whatever the figures", () => {
    const manual = { metric: "MANUAL", name: "Продажи", value: "30.0000", target: "50.0000" } as const;
    expect(kpiPercent(manual, { ...figures, conversions: 0 }, SEPTEMBER)).toBeCloseTo(60);
  });
});

describe("a KPI on one result type", () => {
  const typed = {
    ...figures,
    resultTypes: [
      { type: "MESSAGES" as const, results: 150, spend: 3750 },
      { type: "PROFILE_VISITS" as const, results: 400, spend: 800 },
    ],
  };

  it("counts only the results of its type against the prorated target", () => {
    expect(kpiPercent({ metric: "RESULTS", target: "300", resultType: "MESSAGES" }, typed, {
      from: "2026-09-01", to: "2026-09-15",
    })).toBeCloseTo(100);
  });

  it("takes the cost of its type as spend over results, lower being better", () => {
    expect(kpiPercent({ metric: "COST_PER_RESULT", target: "20", resultType: "MESSAGES" }, typed, SEPTEMBER))
      .toBeCloseTo(80);
  });

  it("counts no results of a type that produced none", () => {
    expect(kpiPercent({ metric: "RESULTS", target: "10", resultType: "LEADS" }, typed, SEPTEMBER)).toBe(0);
  });

  it("has no cost for a type that produced no results", () => {
    expect(kpiPercent({ metric: "COST_PER_RESULT", target: "10", resultType: "LEADS" }, typed, SEPTEMBER)).toBeNull();
  });

  it("is green only by its own type", () => {
    expect(isKpiGreen({ metric: "RESULTS", target: "400", resultType: "PROFILE_VISITS" }, typed, SEPTEMBER)).toBe(true);
    expect(isKpiGreen({ metric: "RESULTS", target: "400", resultType: "MESSAGES" }, typed, SEPTEMBER)).toBe(false);
  });
});

describe("a green KPI", () => {
  it.each([
    [30, true],
    [45, true],
    [29, false],
  ] as const)("reads %s leads against a monthly 30 as green: %s", (conversions, green) => {
    expect(isKpiGreen({ metric: "CONVERSIONS", target: "30.0000" }, { ...figures, conversions }, SEPTEMBER)).toBe(green);
  });

  it("judges the whole percent the marker shows", () => {
    const of = (conversions: number) =>
      isKpiGreen({ metric: "CONVERSIONS", target: "1000.0000" }, { ...figures, conversions }, SEPTEMBER);

    expect(of(996)).toBe(true);
    expect(of(994)).toBe(false);
  });

  it("is not green when the figure is not measured", () => {
    expect(isKpiGreen({ metric: "CPA", target: "10.0000" }, { ...figures, cpa: null }, SEPTEMBER)).toBe(false);
  });
});

describe("the month to date", () => {
  it("runs from the first of the UTC month to today in UTC", () => {
    expect(monthToDate(new Date("2026-10-15T23:30:00Z"))).toEqual({ from: "2026-10-01", to: "2026-10-15" });
    expect(monthToDate(new Date("2026-11-01T00:10:00Z"))).toEqual({ from: "2026-11-01", to: "2026-11-01" });
  });
});
