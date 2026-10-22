import { describe, expect, it } from "vitest";
import { isLowerBetter, isMonthly, KPI_METRICS, kpiInputOf, kpiProgress, targetForRange } from "@/entities/kpi/index.js";

const september = { from: "2026-09-01", to: "2026-09-30" };
const figures = (values: Partial<Record<string, number | null>> = {}) => ({
  spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, results: 0, revenue: 0,
  ctr: null, cpc: null, cpm: null, cpa: null, costPerResult: null, roas: null, frequency: null,
  ...values,
});

describe("the KPI metric catalogue", () => {
  it("offers fourteen metrics in a fixed order", () => {
    expect(KPI_METRICS.map((metric) => metric.id)).toEqual([
      "SPEND", "IMPRESSIONS", "REACH", "CLICKS", "CONVERSIONS", "RESULTS", "REVENUE",
      "CTR", "CPC", "CPM", "CPA", "COST_PER_RESULT", "ROAS", "FREQUENCY",
    ]);
  });

  it("treats summable metrics as monthly and the rest as values", () => {
    expect(KPI_METRICS.filter((metric) => isMonthly(metric.id)).map((metric) => metric.id))
      .toEqual(["SPEND", "IMPRESSIONS", "REACH", "CLICKS", "CONVERSIONS", "RESULTS", "REVENUE"]);
  });

  it("knows which metrics are better lower", () => {
    expect(KPI_METRICS.filter((metric) => isLowerBetter(metric.id)).map((metric) => metric.id))
      .toEqual(["CPC", "CPM", "CPA", "COST_PER_RESULT", "FREQUENCY"]);
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
  it("is exceeded when a summable figure goes past its prorated target", () => {
    expect(kpiProgress(figures({ conversions: 45 }), { metric: "CONVERSIONS", target: "60.0000" }, { from: "2026-09-01", to: "2026-09-15" }))
      .toEqual({ actual: 45, target: 30, percent: 150, state: "exceeded" });
  });

  it("is met when a summable figure lands exactly on its target", () => {
    expect(kpiProgress(figures({ conversions: 60 }), { metric: "CONVERSIONS", target: "60.0000" }, september))
      .toMatchObject({ actual: 60, percent: 100, state: "met" });
  });

  it("is behind when it falls short", () => {
    const progress = kpiProgress(figures({ conversions: 10 }), { metric: "CONVERSIONS", target: "60.0000" }, { from: "2026-09-01", to: "2026-09-15" });
    expect(progress.state).toBe("behind");
    expect(progress.percent).toBeCloseTo(33.333, 2);
  });

  it("compares lower-is-better ratios the other way round", () => {
    const exceeded = kpiProgress(figures({ cpa: 18 }), { metric: "CPA", target: "20.0000" }, september);
    expect(exceeded.state).toBe("exceeded");
    expect(exceeded.percent).toBeCloseTo(111.111, 2);

    expect(kpiProgress(figures({ cpa: 20 }), { metric: "CPA", target: "20.0000" }, september))
      .toEqual({ actual: 20, target: 20, percent: 100, state: "met" });

    const behind = kpiProgress(figures({ cpa: 25 }), { metric: "CPA", target: "20.0000" }, september);
    expect(behind).toEqual({ actual: 25, target: 20, percent: 80, state: "behind" });
  });

  it("judges results against a monthly target", () => {
    const progress = kpiProgress(figures({ results: 56 }), { metric: "RESULTS", target: "60.0000" }, september);
    expect(progress.state).toBe("behind");
    expect(progress.percent).toBeCloseTo(93.333, 2);
  });

  it("meets a cost per result at or below its target", () => {
    expect(kpiProgress(figures({ costPerResult: 3.94 }), { metric: "COST_PER_RESULT", target: "5.0000" }, september).state)
      .toBe("exceeded");
    expect(kpiProgress(figures({ costPerResult: null }), { metric: "COST_PER_RESULT", target: "5.0000" }, september).state)
      .toBe("unmeasured");
  });

  it("is not measurable when the ratio has no value for the period", () => {
    expect(kpiProgress(figures({ cpa: null }), { metric: "CPA", target: "20.0000" }, september))
      .toEqual({ actual: null, target: 20, percent: null, state: "unmeasured" });
  });

  it("is exceeded without a percentage when a lower-is-better figure is zero", () => {
    expect(kpiProgress(figures({ cpc: 0 }), { metric: "CPC", target: "1.5000" }, september))
      .toEqual({ actual: 0, target: 1.5, percent: null, state: "exceeded" });
  });

  it("is behind at zero for a summable figure", () => {
    expect(kpiProgress(figures({ spend: 0 }), { metric: "SPEND", target: "300.0000" }, september))
      .toEqual({ actual: 0, target: 300, percent: 0, state: "behind" });
  });
});

describe("a KPI set by hand", () => {
  const manual = (value: string, target = "50.0000") => ({ metric: "MANUAL" as const, name: "Продажи", value, target });
  const october = { from: "2026-10-01", to: "2026-10-31" };

  it.each([
    ["30.0000", { actual: 30, target: 50, percent: 60, state: "behind" }],
    ["50.0000", { actual: 50, target: 50, percent: 100, state: "met" }],
    ["75.0000", { actual: 75, target: 50, percent: 150, state: "exceeded" }],
    ["0.0000", { actual: 0, target: 50, percent: 0, state: "behind" }],
  ])("reads the value %s over its target, whatever the figures", (value, progress) => {
    expect(kpiProgress(figures({ conversions: 999 }), manual(value), september)).toEqual(progress);
  });

  it("does not depend on the period", () => {
    expect(kpiProgress(figures(), manual("30.0000"), october)).toEqual(kpiProgress(figures(), manual("30.0000"), september));
  });
});

describe("reading a carried KPI", () => {
  it("keeps a measured metric and a KPI set by hand", () => {
    expect(kpiInputOf({ metric: "CPA", target: "10.0000" })).toEqual({ metric: "CPA", target: "10.0000" });
    expect(kpiInputOf({ metric: "MANUAL", name: "Продажи", value: "30.0000", target: "50.0000" }))
      .toEqual({ metric: "MANUAL", name: "Продажи", value: "30.0000", target: "50.0000" });
  });

  it("drops what it cannot compare", () => {
    expect(kpiInputOf(null)).toBeNull();
    expect(kpiInputOf({ metric: "LIKES", target: "10.0000" })).toBeNull();
    expect(kpiInputOf({ metric: "MANUAL", target: "50.0000" })).toBeNull();
  });
});

describe("a KPI on one result type", () => {
  const typed = {
    ...figures({ results: 550, costPerResult: 8 }),
    resultTypes: [
      { type: "MESSAGES", results: 150, spend: 3750 },
      { type: "PROFILE_VISITS", results: 400, spend: 800 },
    ],
  };

  it("counts only its type's results against the prorated target", () => {
    expect(kpiProgress(typed, { metric: "RESULTS", target: "300", resultType: "MESSAGES" }, { from: "2026-09-01", to: "2026-09-15" }))
      .toMatchObject({ actual: 150, target: 150, percent: 100, state: "met" });
  });

  it("costs its type's spend over its results, lower being better", () => {
    expect(kpiProgress(typed, { metric: "COST_PER_RESULT", target: "20", resultType: "MESSAGES" }, september))
      .toMatchObject({ actual: 25, percent: 80, state: "behind" });
  });

  it("has no results of a type the figures do not hold", () => {
    expect(kpiProgress(typed, { metric: "RESULTS", target: "10", resultType: "LEADS" }, september)).toMatchObject({ actual: 0 });
  });

  it("is not measured for the cost of a type without results", () => {
    expect(kpiProgress(typed, { metric: "COST_PER_RESULT", target: "10", resultType: "LEADS" }, september))
      .toMatchObject({ actual: null, state: "unmeasured" });
  });

  it("keeps its type when read from a carried KPI", () => {
    expect(kpiInputOf({ metric: "RESULTS", target: "300", resultType: "MESSAGES" }))
      .toEqual({ metric: "RESULTS", target: "300", resultType: "MESSAGES" });
  });

  it("drops a type carried on a metric that takes none", () => {
    expect(kpiInputOf({ metric: "SPEND", target: "300", resultType: "MESSAGES" })).toEqual({ metric: "SPEND", target: "300" });
  });
});
