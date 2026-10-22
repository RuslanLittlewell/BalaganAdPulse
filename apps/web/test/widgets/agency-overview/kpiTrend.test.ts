import { kpiTrend } from "@/widgets/agency-overview/kpiTrend.js";

const day = (date: string, extra = {}) => ({
  date, spend: 100, impressions: 0, reach: 0, clicks: 0, conversions: 0, results: 0, revenue: 0, ...extra,
});

const OCTOBER = { from: "2026-10-01", to: "2026-10-04" };
const kpis = (...goals: Array<{ metric: string; target: string; name?: string; value?: string }>) =>
  goals.map((goal) => ({ ...goal, enabled: true }));
const leads = { metric: "CONVERSIONS", target: "31.0000" };

describe("the KPI trend of a project", () => {
  it("is the progress reached by each day, counting everything since the period began", () => {
    const trend = kpiTrend(kpis(leads), [day("2026-10-02", { conversions: 3 }), day("2026-10-01", { conversions: 1 }), day("2026-10-04", { conversions: 2 })], OCTOBER);

    expect(trend).toHaveLength(3);
    expect(trend[0]).toBeCloseTo(100);
    expect(trend[1]).toBeCloseTo(200);
    expect(trend[2]).toBeCloseTo(150);
  });

  it("counts lower-is-better metrics in their favourable direction", () => {
    const trend = kpiTrend(kpis({ metric: "CPA", target: "10.0000" }), [day("2026-10-01", { conversions: 5 })], OCTOBER);

    expect(trend).toEqual([50]);
  });

  it("skips days whose figure is not measured", () => {
    const trend = kpiTrend(kpis({ metric: "CPA", target: "10.0000" }), [day("2026-10-01"), day("2026-10-02", { conversions: 10 })], OCTOBER);

    expect(trend).toHaveLength(1);
  });

  it("is empty without a KPI, with one set by hand and without days", () => {
    expect(kpiTrend([], [day("2026-10-01")], OCTOBER)).toEqual([]);
    expect(kpiTrend(kpis({ metric: "MANUAL", name: "Продажи", value: "5.0000", target: "9.0000" }), [day("2026-10-01")], OCTOBER)).toEqual([]);
    expect(kpiTrend(kpis(leads), [], OCTOBER)).toEqual([]);
  });

  it("follows the least-met enabled KPI of each day", () => {
    const days = [day("2026-10-01", { conversions: 2, spend: 100 })];
    const strict = { metric: "CONVERSIONS", target: "62.0000" };

    expect(kpiTrend(kpis(leads, strict), days, OCTOBER)).toEqual([100]);
    expect(kpiTrend(kpis(strict, leads), days, OCTOBER)).toEqual([100]);
    expect(kpiTrend([...kpis(leads), { ...strict, enabled: false }], days, OCTOBER)).toEqual([200]);
  });

  it("is empty when every KPI is switched off", () => {
    expect(kpiTrend([{ ...leads, enabled: false }], [day("2026-10-01", { conversions: 1 })], OCTOBER)).toEqual([]);
  });
});
