import { describe, expect, it } from "vitest";
import {
  isKpiGreen, kpiPercent, kpiReading, kpiStanding, monthToDate, projectKpiPercent, targetForRange, type CarriedKpi, type KpiFigures,
} from "../../src/modules/kpi/index.js";
import type { KpiAccount } from "../../src/modules/campaigns/index.js";

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

  it("compares a KPI set by hand with its target recalculated for the period, whatever the figures", () => {
    const manual = (value: string) => ({ metric: "MANUAL", name: "Продажи", value, target: "50.0000" }) as const;

    expect(kpiPercent(manual("30.0000"), { ...figures, conversions: 0 }, SEPTEMBER)).toBe(60);
    expect(kpiPercent(manual("30.0000"), figures, { from: "2026-09-01", to: "2026-09-15" })).toBe(120);
    expect(isKpiGreen(manual("20.0000"), figures, { from: "2026-09-01", to: "2026-09-10" })).toBe(true);
    expect(isKpiGreen(manual("49.0000"), figures, SEPTEMBER)).toBe(false);
  });

  it("gives a monthly target exactly for whole months and their parts", () => {
    expect(targetForRange("CONVERSIONS", 50, SEPTEMBER)).toBe(50);
    expect(targetForRange("CONVERSIONS", 50, { from: "2026-09-16", to: "2026-10-31" })).toBe(75);
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

describe("a KPI's reading", () => {
  it("gives the figure and the prorated target beside the percent", () => {
    expect(kpiReading({ metric: "CONVERSIONS", target: "60.0000" }, { ...figures, conversions: 45 }, {
      from: "2026-09-01", to: "2026-09-15",
    })).toEqual({ actual: 45, target: 30, percent: 150 });
  });

  it("gives a KPI set by hand its own value", () => {
    expect(kpiReading({ metric: "MANUAL", name: "Продажи", value: "30.0000", target: "50.0000" }, figures, SEPTEMBER))
      .toEqual({ actual: 30, target: 50, percent: 60 });
  });
});

describe("a project's KPI standing", () => {
  const OCTOBER = { from: "2026-10-01", to: "2026-10-31" };
  const first: KpiAccount = { channel: "META", accountId: "act_1" };
  const second: KpiAccount = { channel: "META", accountId: "act_2" };
  const on = (kpi: Omit<CarriedKpi, "enabled" | "account">, account: KpiAccount | null = null): CarriedKpi =>
    ({ ...kpi, enabled: true, account });
  const leads = on({ metric: "CONVERSIONS", target: "30.0000" });
  const cpa = (target: string, account: KpiAccount | null = null) => on({ metric: "CPA", target }, account);
  const whole = (measured: KpiFigures) => () => measured;
  const percentOf = (kpis: CarriedKpi[], measured: KpiFigures = figures, range = SEPTEMBER) =>
    projectKpiPercent(kpis, whole(measured), range);

  it.each([
    [30, "met"],
    [27, "met"],
    [26, "behind"],
    [21, "behind"],
    [20, "danger"],
    [0, "danger"],
  ] as const)("reads %s leads against a target of 30 as %s", (conversions, standing) => {
    expect(kpiStanding(percentOf([leads], { ...figures, conversions }))).toBe(standing);
  });

  it("judges the whole percent", () => {
    const of = (conversions: number) =>
      kpiStanding(percentOf([on({ metric: "CONVERSIONS", target: "1000.0000" })], { ...figures, conversions }));

    expect(of(896)).toBe("met");
    expect(of(894)).toBe("behind");
    expect(of(696)).toBe("behind");
    expect(of(694)).toBe("danger");
  });

  it("paints a monthly target met exactly over a 31-day month as met", () => {
    expect(kpiStanding(percentOf([on({ metric: "CONVERSIONS", target: "60.0000" })], { ...figures, conversions: 60 }, OCTOBER)))
      .toBe("met");
  });

  it("follows a KPI set by hand whatever the figures", () => {
    const manual = (value: string) => on({ metric: "MANUAL", name: "Продажи", value, target: "50.0000" });

    expect(kpiStanding(percentOf([manual("30.0000")]))).toBe("danger");
    expect(kpiStanding(percentOf([manual("40.0000")]))).toBe("behind");
    expect(kpiStanding(percentOf([manual("50.0000")]))).toBe("met");
  });

  it("averages its KPIs, each counted up to 100%", () => {
    expect(percentOf([leads, cpa("8.0000")])).toBe(90);
    expect(percentOf([leads, cpa("8.0000")], { ...figures, conversions: 45 })).toBe(90);
    expect(kpiStanding(percentOf([leads, cpa("6.0000")]))).toBe("behind");
  });

  it("ignores a KPI that is switched off, and has nothing to judge when all are", () => {
    expect(percentOf([leads, { ...cpa("8.0000"), enabled: false }])).toBe(100);
    expect(percentOf([{ ...leads, enabled: false }])).toBeNull();
    expect(kpiStanding(null)).toBe("none");
  });

  it("skips a KPI whose figure is not measured, or whose metric it does not know", () => {
    expect(percentOf([cpa("10.0000"), leads], { ...figures, cpa: null })).toBe(100);
    expect(percentOf([on({ metric: "MAGENTA", target: "10.0000" })])).toBeNull();
  });

  it("gives each account an equal share, measured on its figures", () => {
    const byAccount = (account: KpiAccount | null): KpiFigures =>
      account === null ? { ...figures, conversions: 24 }
        : account.accountId === "act_1" ? { ...figures, conversions: 30 } : { ...figures, conversions: 15 };

    expect(projectKpiPercent([{ ...leads, account: first }, { ...leads, account: second }], byAccount, SEPTEMBER)).toBe(75);
    expect(projectKpiPercent([{ ...leads, account: first }, cpa("5.0000", first), { ...leads, account: second }], byAccount, SEPTEMBER))
      .toBe(63);
    expect(projectKpiPercent([leads, { ...leads, account: second }], byAccount, SEPTEMBER)).toBe(65);
  });
});
