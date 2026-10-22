import { projectKpiPercent, projectTone } from "@/widgets/project-list/projectTone.js";

const SEPTEMBER = { from: "2026-09-01", to: "2026-09-30" };
const OCTOBER = { from: "2026-10-01", to: "2026-10-31" };

const performance = {
  spend: 1000, impressions: 100000, reach: 40000, clicks: 2000, conversions: 30, results: 50, revenue: 4000,
  ctr: 2, cpc: 0.5, cpm: 10, cpa: 10, costPerResult: 20, roas: 4, frequency: 2.5,
};

const on = (kpi: { metric: string; target: string; name?: string; value?: string }) => ({ ...kpi, enabled: true });
const off = (kpi: { metric: string; target: string }) => ({ ...kpi, enabled: false });
const leads = on({ metric: "CONVERSIONS", target: "30.0000" });
const cpa = (target: string) => on({ metric: "CPA", target });

describe("a project's marker", () => {
  it.each([
    [30, "met"],
    [45, "met"],
    [27, "met"],
    [26, "behind"],
    [21, "behind"],
    [20, "danger"],
    [0, "danger"],
  ] as const)("reads %s leads against a target of 30 as %s", (conversions, tone) => {
    expect(projectTone([leads], { ...performance, conversions }, SEPTEMBER)).toBe(tone);
  });

  it("counts a lower-is-better KPI in its favourable direction", () => {
    const cpaOf = (value: number) => projectTone([cpa("10.0000")], { ...performance, cpa: value }, SEPTEMBER);

    expect(cpaOf(10)).toBe("met");
    expect(cpaOf(12)).toBe("behind");
    expect(cpaOf(15)).toBe("danger");
  });

  it("paints a monthly target met exactly over a 31-day month green", () => {
    expect(projectTone([on({ metric: "CONVERSIONS", target: "60.0000" })], { ...performance, conversions: 60 }, OCTOBER))
      .toBe("met");
  });

  it("judges the whole percent the KPI tile shows", () => {
    const of = (conversions: number) =>
      projectTone([on({ metric: "CONVERSIONS", target: "1000.0000" })], { ...performance, conversions }, SEPTEMBER);

    expect(of(896)).toBe("met");
    expect(of(894)).toBe("behind");
    expect(of(696)).toBe("behind");
    expect(of(694)).toBe("danger");
  });

  it.each([
    ["30.0000", "danger"],
    ["40.0000", "behind"],
    ["50.0000", "met"],
  ] as const)("follows a KPI set by hand with the value %s against 50 as %s, whatever the figures", (value, tone) => {
    const manual = on({ metric: "MANUAL", name: "Продажи", value, target: "50.0000" });
    expect(projectTone([manual], { ...performance, conversions: 0 }, SEPTEMBER)).toBe(tone);
    expect(projectTone([manual], performance, OCTOBER)).toBe(tone);
  });

  it("has nothing to judge without a KPI", () => {
    expect(projectTone([], performance, SEPTEMBER)).toBe("none");
    expect(projectTone(undefined, performance, SEPTEMBER)).toBe("none");
  });

  it("has nothing to judge when the KPI's figure is not measured", () => {
    expect(projectTone([cpa("10.0000")], { ...performance, cpa: null }, SEPTEMBER)).toBe("none");
  });

  it("has nothing to judge for a metric it does not know", () => {
    expect(projectTone([on({ metric: "MAGENTA", target: "10.0000" })], performance, SEPTEMBER)).toBe("none");
  });
});

describe("a project with several KPIs", () => {
  const behindOnCpa = [leads, cpa("8.0000")];

  it("takes the least-met KPI as its result", () => {
    expect(projectKpiPercent(behindOnCpa, performance, SEPTEMBER)).toBe(80);
    expect(projectTone(behindOnCpa, performance, SEPTEMBER)).toBe("behind");
  });

  it("ignores a KPI that is switched off", () => {
    expect(projectKpiPercent([leads, off({ metric: "CPA", target: "8.0000" })], performance, SEPTEMBER)).toBe(100);
    expect(projectTone([leads, off({ metric: "CPA", target: "1.0000" })], performance, SEPTEMBER)).toBe("met");
  });

  it("has nothing to judge when every KPI is switched off", () => {
    expect(projectTone([off({ metric: "CONVERSIONS", target: "30.0000" })], performance, SEPTEMBER)).toBe("none");
    expect(projectKpiPercent([off({ metric: "CONVERSIONS", target: "30.0000" })], performance, SEPTEMBER)).toBeNull();
  });

  it("skips a KPI whose figure is not measured and judges by the others", () => {
    expect(projectKpiPercent([cpa("10.0000"), leads], { ...performance, cpa: null }, SEPTEMBER)).toBe(100);
  });
});
