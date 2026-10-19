import { aProject } from "@test/shared/index.js";
import { monthlyKpiStandings } from "@/widgets/agency-overview/monthlyKpiStandings.js";

const OCTOBER_SO_FAR = { from: "2026-10-01", to: "2026-10-15" };

const performance = {
  spend: 1000, impressions: 100000, reach: 40000, clicks: 2000, conversions: 30, results: 50, revenue: 4000,
  ctr: 2, cpc: 0.5, cpm: 10, cpa: 10, costPerResult: 20, roas: 4, frequency: 2.5,
};

const leads = (target: string) => ({ metric: "CONVERSIONS", target });

const figures = (projectId: string, kpi: unknown, extra = {}) => ({
  projectId,
  kpi: kpi as { metric: string; target: string } | null,
  performance: { ...performance, ...extra },
  days: [],
});

const projects = (...ids: string[]) => ids.map((id) => aProject({ id, name: `Проект ${id}` }));

describe("this month's KPI standings", () => {
  it("counts each project as met, behind or unrated and lists the ones without a KPI", () => {
    const standings = monthlyKpiStandings(projects("a", "b", "c", "d"), [
      figures("a", leads("62.0000")),
      figures("b", leads("62.0000"), { conversions: 20 }),
      figures("c", null),
      figures("d", { metric: "CPA", target: "10.0000" }, { cpa: null }),
    ], OCTOBER_SO_FAR);

    expect(standings).toMatchObject({ met: 1, behind: 1, unrated: 2 });
    expect(standings.withoutKpi.map((project) => project.id)).toEqual(["c"]);
  });

  it("prorates a monthly target to the days of the month so far", () => {
    const of = (conversions: number) =>
      monthlyKpiStandings(projects("a"), [figures("a", leads("62.0000"), { conversions })], OCTOBER_SO_FAR);

    expect(of(30)).toMatchObject({ met: 1, behind: 0 });
    expect(of(29)).toMatchObject({ met: 0, behind: 1 });
  });

  it("counts a project in the marker's yellow zone as behind", () => {
    const standings = monthlyKpiStandings(projects("a"), [figures("a", leads("30.0000"), { conversions: 27 })], {
      from: "2026-09-01", to: "2026-09-30",
    });

    expect(standings).toMatchObject({ met: 0, behind: 1, unrated: 0 });
  });

  it("judges a KPI set by hand by its value, whatever the figures", () => {
    const manual = { metric: "MANUAL", name: "Продажи", value: "50.0000", target: "40.0000" };
    const standings = monthlyKpiStandings(projects("a"), [figures("a", manual, { conversions: 0 })], OCTOBER_SO_FAR);

    expect(standings).toMatchObject({ met: 1, behind: 0, unrated: 0, withoutKpi: [] });
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
});
