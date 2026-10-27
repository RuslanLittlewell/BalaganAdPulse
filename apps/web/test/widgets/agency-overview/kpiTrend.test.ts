import { EMPTY_PERFORMANCE, type AccountFigures, type AdAccount, type ProjectFigures } from "@/entities/campaign/index.js";
import { kpiTrend } from "@/widgets/agency-overview/kpiTrend.js";

type Goal = { metric: string; target: string; name?: string; value?: string; enabled: boolean; account?: AdAccount | null };

const entry = (goals: Goal[], days: ProjectFigures["days"], accounts: AccountFigures[] = []): ProjectFigures => ({
  projectId: "project-1",
  kpis: goals.map((goal) => ({ ...goal, account: goal.account ?? null })),
  performance: EMPTY_PERFORMANCE,
  days,
  accounts,
});

const day = (date: string, extra = {}) => ({
  date, spend: 100, impressions: 0, reach: 0, clicks: 0, conversions: 0, results: 0, revenue: 0, ...extra,
});

const OCTOBER = { from: "2026-10-01", to: "2026-10-04" };
const kpis = (...goals: Array<{ metric: string; target: string; name?: string; value?: string }>) =>
  goals.map((goal) => ({ ...goal, enabled: true }));
const leads = { metric: "CONVERSIONS", target: "31.0000" };

describe("the KPI trend of a project", () => {
  it("is the progress reached by each day, counting everything since the period began", () => {
    const plan = { metric: "CONVERSIONS", target: "124.0000" };
    const trend = kpiTrend(entry(kpis(plan), [day("2026-10-02", { conversions: 3 }), day("2026-10-01", { conversions: 1 }), day("2026-10-04", { conversions: 2 })]), OCTOBER);

    expect(trend).toHaveLength(3);
    expect(trend[0]).toBeCloseTo(25);
    expect(trend[1]).toBeCloseTo(50);
    expect(trend[2]).toBeCloseTo(37.5);
  });

  it("counts lower-is-better metrics in their favourable direction", () => {
    const trend = kpiTrend(entry(kpis({ metric: "CPA", target: "10.0000" }), [day("2026-10-01", { conversions: 5 })]), OCTOBER);

    expect(trend).toEqual([50]);
  });

  it("skips days whose figure is not measured", () => {
    const trend = kpiTrend(entry(kpis({ metric: "CPA", target: "10.0000" }), [day("2026-10-01"), day("2026-10-02", { conversions: 10 })]), OCTOBER);

    expect(trend).toHaveLength(1);
  });

  it("is empty without a KPI, with one set by hand and without days", () => {
    expect(kpiTrend(entry([], [day("2026-10-01")]), OCTOBER)).toEqual([]);
    expect(kpiTrend(entry(kpis({ metric: "MANUAL", name: "Продажи", value: "5.0000", target: "9.0000" }), [day("2026-10-01")]), OCTOBER)).toEqual([]);
    expect(kpiTrend(entry(kpis(leads), []), OCTOBER)).toEqual([]);
  });

  it("averages the enabled KPIs of each day, each counted at most 100%", () => {
    const days = [day("2026-10-01", { conversions: 2, spend: 100 })];
    const strict = { metric: "CONVERSIONS", target: "124.0000" };

    expect(kpiTrend(entry(kpis(leads, strict), days), OCTOBER)).toEqual([75]);
    expect(kpiTrend(entry(kpis(strict, leads), days), OCTOBER)).toEqual([75]);
    expect(kpiTrend(entry([...kpis(leads), { ...strict, enabled: false }], days), OCTOBER)).toEqual([100]);
  });

  it("follows a KPI naming an account on that account's days alone", () => {
    const first = { channel: "META" as const, accountId: "act_1" };
    const days = [day("2026-10-01", { conversions: 3 }), day("2026-10-02", { conversions: 3 })];
    const own = [day("2026-10-01", { conversions: 1 }), day("2026-10-02", { conversions: 1 })];

    const plan = { metric: "CONVERSIONS", target: "62.0000" };
    const trend = kpiTrend(
      entry([{ ...plan, enabled: true, account: first }], days, [{ ...first, performance: EMPTY_PERFORMANCE, days: own }]),
      OCTOBER,
    );

    expect(trend).toHaveLength(2);
    expect(trend[0]).toBeCloseTo(50);
    expect(trend[1]).toBeCloseTo(50);
  });

  it("is empty when every KPI is switched off", () => {
    expect(kpiTrend(entry([{ ...leads, enabled: false }], [day("2026-10-01", { conversions: 1 })]), OCTOBER)).toEqual([]);
  });
});
