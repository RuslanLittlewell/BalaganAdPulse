import { aProject } from "@test/shared/index.js";
import { monthlyKpiStandings } from "@/widgets/agency-overview/monthlyKpiStandings.js";

const OCTOBER_SO_FAR = { from: "2026-10-01", to: "2026-10-15" };

const performance = {
  spend: 1000, impressions: 100000, reach: 40000, clicks: 2000, conversions: 30, results: 50, revenue: 4000,
  ctr: 2, cpc: 0.5, cpm: 10, cpa: 10, costPerResult: 20, roas: 4, frequency: 2.5,
};

const leads = (target: string) => ({ metric: "CONVERSIONS", target });

type Goal = { metric: string; target: string; name?: string; value?: string };

const figures = (projectId: string, kpi: Goal | Goal[] | null, extra = {}) => ({
  projectId,
  kpis: (kpi === null ? [] : Array.isArray(kpi) ? kpi : [kpi]).map((goal) => ({ enabled: true, ...goal })),
  performance: { ...performance, ...extra },
  days: [],
});

const projects = (...ids: string[]) => ids.map((id) => aProject({ id, name: `Проект ${id}` }));

describe("this month's KPI standings", () => {
  it("counts each project as met, behind, far behind or unrated and lists the ones without a KPI", () => {
    const standings = monthlyKpiStandings(projects("a", "b", "c", "d"), [
      figures("a", leads("62.0000")),
      figures("b", leads("62.0000"), { conversions: 20 }),
      figures("c", null),
      figures("d", { metric: "CPA", target: "10.0000" }, { cpa: null }),
    ], OCTOBER_SO_FAR);

    expect(standings).toMatchObject({ met: 1, behind: 0, danger: 1, unrated: 2 });
    expect(standings.withoutKpi.map((project) => project.id)).toEqual(["c"]);
  });

  it("prorates a monthly target to the days of the month so far", () => {
    const of = (conversions: number) =>
      monthlyKpiStandings(projects("a"), [figures("a", leads("62.0000"), { conversions })], OCTOBER_SO_FAR);

    expect(of(27)).toMatchObject({ met: 1, behind: 0, danger: 0 });
    expect(of(26)).toMatchObject({ met: 0, behind: 1, danger: 0 });
    expect(of(20)).toMatchObject({ met: 0, behind: 0, danger: 1 });
  });

  it("counts a project in the marker's yellow zone as behind", () => {
    const standings = monthlyKpiStandings(projects("a"), [figures("a", leads("30.0000"), { conversions: 24 })], {
      from: "2026-09-01", to: "2026-09-30",
    });

    expect(standings).toMatchObject({ met: 0, behind: 1, danger: 0, unrated: 0 });
  });

  it("judges a KPI set by hand by its value, whatever the figures", () => {
    const manual = { metric: "MANUAL", name: "Продажи", value: "50.0000", target: "40.0000" };
    const standings = monthlyKpiStandings(projects("a"), [figures("a", manual, { conversions: 0 })], OCTOBER_SO_FAR);

    expect(standings).toMatchObject({ met: 1, behind: 0, danger: 0, unrated: 0, withoutKpi: [] });
  });

  it("treats a project the summary does not carry as one without a KPI", () => {
    const standings = monthlyKpiStandings(projects("a"), [], OCTOBER_SO_FAR);

    expect(standings).toMatchObject({ met: 0, behind: 0, unrated: 1 });
    expect(standings.withoutKpi.map((project) => project.id)).toEqual(["a"]);
  });

  it("lists the projects without a KPI in the project order", () => {
    const standings = monthlyKpiStandings(projects("z", "y", "x"), [
      figures("x", null), figures("y", leads("10.0000")), figures("z", null),
    ], OCTOBER_SO_FAR);

    expect(standings.withoutKpi.map((project) => project.id)).toEqual(["z", "x"]);
  });

  it("judges a project with several KPIs by the least-met one", () => {
    const standings = monthlyKpiStandings(projects("a", "b"), [
      figures("a", [leads("62.0000"), { metric: "CPA", target: "8.0000" }]),
      figures("b", [leads("62.0000"), { metric: "CPA", target: "10.0000" }]),
    ], OCTOBER_SO_FAR);

    expect(standings).toMatchObject({ met: 1, behind: 1, danger: 0, unrated: 0 });
  });

  it("leaves a switched-off KPI out of the result and counts a project with none switched on as without a KPI", () => {
    const off = (goal: Goal) => ({ ...goal, enabled: false });
    const standings = monthlyKpiStandings(projects("a", "b"), [
      { ...figures("a", leads("62.0000")), kpis: [{ ...leads("62.0000"), enabled: true }, off({ metric: "CPA", target: "1.0000" })] },
      { ...figures("b", null), kpis: [off(leads("62.0000"))] },
    ], OCTOBER_SO_FAR);

    expect(standings).toMatchObject({ met: 1, behind: 0, danger: 0, unrated: 1 });
    expect(standings.withoutKpi.map((project) => project.id)).toEqual(["b"]);
  });

  it("leaves a project whose KPIs are not tracked out altogether, not even as unrated or without a KPI", () => {
    const standings = monthlyKpiStandings(
      [aProject({ id: "a", name: "Проект a" }), aProject({ id: "b", name: "Проект b", kpiTracked: false }), aProject({ id: "c", name: "Проект c", kpiTracked: false })],
      [figures("a", leads("62.0000")), figures("b", leads("62.0000")), figures("c", null)],
      OCTOBER_SO_FAR,
    );

    expect(standings).toMatchObject({ met: 1, behind: 0, danger: 0, unrated: 0 });
    expect(standings.withoutKpi).toEqual([]);
  });
});
