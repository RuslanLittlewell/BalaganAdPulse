import { describe, expect, it } from "vitest";
import { isLowerBetter, isMonthly, KPI_METRICS, kpiProgress, targetForRange } from "@/entities/kpi/index.js";

const september = { from: "2026-09-01", to: "2026-09-30" };
const figures = (values: Partial<Record<string, number | null>> = {}) => ({
  spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, revenue: 0,
  ctr: null, cpc: null, cpm: null, cpa: null, roas: null, frequency: null,
  ...values,
});

describe("the KPI metric catalogue", () => {
  it("offers twelve metrics in a fixed order", () => {
    expect(KPI_METRICS.map((metric) => metric.id)).toEqual([
      "SPEND", "IMPRESSIONS", "REACH", "CLICKS", "CONVERSIONS", "REVENUE", "CTR", "CPC", "CPM", "CPA", "ROAS", "FREQUENCY",
    ]);
  });

  it("treats summable metrics as monthly and the rest as values", () => {
    expect(KPI_METRICS.filter((metric) => isMonthly(metric.id)).map((metric) => metric.id))
      .toEqual(["SPEND", "IMPRESSIONS", "REACH", "CLICKS", "CONVERSIONS", "REVENUE"]);
  });

  it("knows which metrics are better lower", () => {
    expect(KPI_METRICS.filter((metric) => isLowerBetter(metric.id)).map((metric) => metric.id))
      .toEqual(["CPC", "CPM", "CPA", "FREQUENCY"]);
  });
});

describe("the target for a reporting period", () => {
  it("is the monthly target for a whole calendar month", () => {
    expect(targetForRange("CONVERSIONS", 60, september)).toBeCloseTo(60, 10);
  });

  it("is prorated for a week", () => {
    expect(targetForRange("CONVERSIONS", 60, { from: "2026-09-01", to: "2026-09-07" })).toBeCloseTo(14, 10);
  });

  it("follows each day's own month across a month boundary", () => {
    expect(targetForRange("SPEND", 60, { from: "2026-08-31", to: "2026-09-01" })).toBeCloseTo(60 / 31 + 60 / 30, 10);
  });

  it("stays as it is for ratios", () => {
    expect(targetForRange("CPA", 20, { from: "2026-09-01", to: "2026-09-07" })).toBe(20);
    expect(targetForRange("ROAS", 3, { from: "2026-01-01", to: "2026-12-31" })).toBe(3);
  });
});

describe("progress against a KPI", () => {
  it("is met when a summable figure reaches its prorated target", () => {
    expect(kpiProgress(figures({ conversions: 45 }), { metric: "CONVERSIONS", target: "60.0000" }, { from: "2026-09-01", to: "2026-09-15" }))
      .toEqual({ actual: 45, target: 30, percent: 150, state: "met" });
  });

  it("is behind when it falls short", () => {
    const progress = kpiProgress(figures({ conversions: 10 }), { metric: "CONVERSIONS", target: "60.0000" }, { from: "2026-09-01", to: "2026-09-15" });
    expect(progress.state).toBe("behind");
    expect(progress.percent).toBeCloseTo(33.333, 2);
  });

  it("compares lower-is-better ratios the other way round", () => {
    const met = kpiProgress(figures({ cpa: 18 }), { metric: "CPA", target: "20.0000" }, september);
    expect(met.state).toBe("met");
    expect(met.percent).toBeCloseTo(111.111, 2);

    const behind = kpiProgress(figures({ cpa: 25 }), { metric: "CPA", target: "20.0000" }, september);
    expect(behind).toEqual({ actual: 25, target: 20, percent: 80, state: "behind" });
  });

  it("is not measurable when the ratio has no value for the period", () => {
    expect(kpiProgress(figures({ cpa: null }), { metric: "CPA", target: "20.0000" }, september))
      .toEqual({ actual: null, target: 20, percent: null, state: "unmeasured" });
  });

  it("is met without a percentage when a lower-is-better figure is zero", () => {
    expect(kpiProgress(figures({ cpc: 0 }), { metric: "CPC", target: "1.5000" }, september))
      .toEqual({ actual: 0, target: 1.5, percent: null, state: "met" });
  });

  it("is behind at zero for a summable figure", () => {
    expect(kpiProgress(figures({ spend: 0 }), { metric: "SPEND", target: "300.0000" }, september))
      .toEqual({ actual: 0, target: 300, percent: 0, state: "behind" });
  });
});
