import type { AccountFigures, AdAccount, Performance, ProjectFigures } from "@/entities/campaign/index.js";
import { projectKpiPercent, projectTone } from "@/widgets/project-list/projectTone.js";

type Goal = { metric: string; target: string; name?: string; value?: string; enabled: boolean; account?: AdAccount | null };

const entry = (goals: Goal[], performance: Performance, accounts: AccountFigures[] = []): ProjectFigures => ({
  projectId: "project-1",
  kpis: goals.map((goal) => ({ ...goal, account: goal.account ?? null })),
  performance,
  days: [],
  accounts,
});

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
    expect(projectTone(entry([leads], { ...performance, conversions }), SEPTEMBER)).toBe(tone);
  });

  it("counts a lower-is-better KPI in its favourable direction", () => {
    const cpaOf = (value: number) => projectTone(entry([cpa("10.0000")], { ...performance, cpa: value }), SEPTEMBER);

    expect(cpaOf(10)).toBe("met");
    expect(cpaOf(12)).toBe("behind");
    expect(cpaOf(15)).toBe("danger");
  });

  it("paints a monthly target met exactly over a 31-day month green", () => {
    expect(projectTone(entry([on({ metric: "CONVERSIONS", target: "60.0000" })], { ...performance, conversions: 60 }), OCTOBER))
      .toBe("met");
  });

  it("judges the whole percent the KPI tile shows", () => {
    const of = (conversions: number) =>
      projectTone(entry([on({ metric: "CONVERSIONS", target: "1000.0000" })], { ...performance, conversions }), SEPTEMBER);

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
    expect(projectTone(entry([manual], { ...performance, conversions: 0 }), SEPTEMBER)).toBe(tone);
    expect(projectTone(entry([manual], performance), OCTOBER)).toBe(tone);
  });

  it("has nothing to judge without a KPI", () => {
    expect(projectTone(entry([], performance), SEPTEMBER)).toBe("none");
    expect(projectTone(undefined, SEPTEMBER)).toBe("none");
  });

  it("has nothing to judge when the KPI's figure is not measured", () => {
    expect(projectTone(entry([cpa("10.0000")], { ...performance, cpa: null }), SEPTEMBER)).toBe("none");
  });

  it("has nothing to judge for a metric it does not know", () => {
    expect(projectTone(entry([on({ metric: "MAGENTA", target: "10.0000" })], performance), SEPTEMBER)).toBe("none");
  });
});

describe("a project with several KPIs", () => {
  const behindOnCpa = [leads, cpa("8.0000")];

  it("averages its KPIs as its result", () => {
    expect(projectKpiPercent(entry(behindOnCpa, performance), SEPTEMBER)).toBe(90);
    expect(projectTone(entry(behindOnCpa, performance), SEPTEMBER)).toBe("met");
    expect(projectTone(entry([leads, cpa("6.0000")], performance), SEPTEMBER)).toBe("behind");
  });

  it("counts a KPI over its target as 100%", () => {
    expect(projectKpiPercent(entry(behindOnCpa, { ...performance, conversions: 45 }), SEPTEMBER)).toBe(90);
  });

  it("ignores a KPI that is switched off", () => {
    expect(projectKpiPercent(entry([leads, off({ metric: "CPA", target: "8.0000" })], performance), SEPTEMBER)).toBe(100);
    expect(projectTone(entry([leads, off({ metric: "CPA", target: "1.0000" })], performance), SEPTEMBER)).toBe("met");
  });

  it("has nothing to judge when every KPI is switched off", () => {
    expect(projectTone(entry([off({ metric: "CONVERSIONS", target: "30.0000" })], performance), SEPTEMBER)).toBe("none");
    expect(projectKpiPercent(entry([off({ metric: "CONVERSIONS", target: "30.0000" })], performance), SEPTEMBER)).toBeNull();
  });

  it("skips a KPI whose figure is not measured and judges by the others", () => {
    expect(projectKpiPercent(entry([cpa("10.0000"), leads], { ...performance, cpa: null }), SEPTEMBER)).toBe(100);
  });
});

describe("a project whose KPIs name accounts", () => {
  const first = { channel: "META" as const, accountId: "act_1" };
  const second = { channel: "META" as const, accountId: "act_2" };
  const accounts = [
    { ...first, performance: { ...performance, conversions: 30 }, days: [] },
    { ...second, performance: { ...performance, conversions: 15 }, days: [] },
  ];

  it("gives each account an equal share, measured on its figures", () => {
    const together = { ...performance, conversions: 45 };

    expect(projectKpiPercent(entry([{ ...leads, account: first }], together, accounts), SEPTEMBER)).toBe(100);
    expect(projectKpiPercent(entry([{ ...leads, account: first }, { ...leads, account: second }], together, accounts), SEPTEMBER))
      .toBe(75);
  });

  it("splits an account's share between its KPIs", () => {
    const kpis = [{ ...leads, account: first }, { ...cpa("5.0000"), account: first }, { ...leads, account: second }];

    expect(projectKpiPercent(entry(kpis, performance, accounts), SEPTEMBER)).toBe(63);
  });

  it("measures a KPI naming no account on the whole project, as a share of its own", () => {
    expect(projectKpiPercent(entry([leads], { ...performance, conversions: 24 }, accounts), SEPTEMBER)).toBe(80);
    expect(projectKpiPercent(entry([leads, { ...leads, account: second }], { ...performance, conversions: 24 }, accounts), SEPTEMBER))
      .toBe(65);
  });

  it("measures a KPI naming an account without figures on nothing", () => {
    const gone = { channel: "GOOGLE" as const, accountId: "123" };

    expect(projectKpiPercent(entry([{ ...leads, account: gone }], performance, accounts), SEPTEMBER)).toBe(0);
  });
});
