import { campaignTone } from "@/pages/project/campaignTone.js";

const SEPTEMBER = { from: "2026-09-01", to: "2026-09-30" };

const performance = {
  spend: 1000, impressions: 100000, reach: 40000, clicks: 2000, conversions: 30, results: 50, revenue: 4000,
  ctr: 2, cpc: 0.5, cpm: 10, cpa: 10, costPerResult: 20, roas: 4, frequency: 2.5,
};

const campaign = (overrides: Partial<Parameters<typeof campaignTone>[0]> = {}) => ({
  status: "ACTIVE" as const,
  kpi: { metric: "CONVERSIONS", target: "30.0000" },
  performance,
  resultTypes: [] as Parameters<typeof campaignTone>[0]["resultTypes"],
  ...overrides,
});

describe("a campaign's indicator", () => {
  it.each([
    [30, "profitable"],
    [45, "profitable"],
    [27, "profitable"],
    [26, "stable"],
    [21, "stable"],
    [20, "danger"],
    [0, "danger"],
  ] as const)("reads %s leads against a target of 30 as %s", (conversions, tone) => {
    expect(campaignTone(campaign({ performance: { ...performance, conversions } }), null, SEPTEMBER)).toBe(tone);
  });

  it("counts a lower-is-better KPI in its favourable direction", () => {
    const cpaOf = (cpa: number) => campaignTone(
      campaign({ kpi: { metric: "CPA", target: "10.0000" }, performance: { ...performance, cpa } }),
      null,
      SEPTEMBER,
    );

    expect(cpaOf(9)).toBe("profitable");
    expect(cpaOf(12)).toBe("stable");
    expect(cpaOf(15)).toBe("danger");
  });

  it("falls back to the project's KPI when the campaign has none", () => {
    const projectKpis = [{ metric: "CONVERSIONS", target: "20.0000", enabled: true }];
    expect(campaignTone(campaign({ kpi: null }), projectKpis, SEPTEMBER)).toBe("profitable");
  });

  it("falls back to the project's least-met KPI", () => {
    const projectKpis = [
      { metric: "CONVERSIONS", target: "20.0000", enabled: true },
      { metric: "CPA", target: "8.0000", enabled: true },
    ];
    expect(campaignTone(campaign({ kpi: null }), projectKpis, SEPTEMBER)).toBe("stable");
  });

  it("does not fall back to a project KPI that is switched off", () => {
    const projectKpis = [
      { metric: "CONVERSIONS", target: "20.0000", enabled: true },
      { metric: "CPA", target: "1.0000", enabled: false },
    ];
    expect(campaignTone(campaign({ kpi: null }), projectKpis, SEPTEMBER)).toBe("profitable");
    expect(campaignTone(campaign({ kpi: null }), [projectKpis[1]!], SEPTEMBER)).toBe("idle");
  });

  it("does not fall back to a project KPI set by hand", () => {
    const projectKpis = [{ metric: "MANUAL", name: "Продажи", value: "500.0000", target: "50.0000", enabled: true }];
    expect(campaignTone(campaign({ kpi: null }), projectKpis, SEPTEMBER)).toBe("idle");
  });

  it("prefers the campaign's own KPI over the project's", () => {
    const projectKpis = [{ metric: "CONVERSIONS", target: "10.0000", enabled: true }];
    expect(campaignTone(campaign({ kpi: { metric: "CONVERSIONS", target: "100.0000" } }), projectKpis, SEPTEMBER)).toBe("danger");
  });

  it("is grey without any KPI", () => {
    expect(campaignTone(campaign({ kpi: null }), [], SEPTEMBER)).toBe("idle");
  });

  it("is grey when the KPI's figure is not measured", () => {
    const unmeasured = campaign({ kpi: { metric: "CPA", target: "10.0000" }, performance: { ...performance, cpa: null } });
    expect(campaignTone(unmeasured, null, SEPTEMBER)).toBe("idle");
  });

  it.each(["PAUSED", "REJECTED", "ENDED"] as const)("is grey for a %s campaign, whatever its figures", (status) => {
    expect(campaignTone(campaign({ status }), null, SEPTEMBER)).toBe("idle");
  });

  it("counts a learning campaign as running", () => {
    expect(campaignTone(campaign({ status: "LEARNING" }), null, SEPTEMBER)).toBe("profitable");
  });

  it("judges a campaign only by the project KPIs on result types it optimises for", () => {
    const typed = {
      ...performance,
      resultTypes: [{ type: "PROFILE_VISITS" as const, results: 400, spend: 800 }],
    };
    const projectKpis = [
      { metric: "RESULTS", target: "300", resultType: "MESSAGES", enabled: true },
      { metric: "RESULTS", target: "400", resultType: "PROFILE_VISITS", enabled: true },
    ];

    expect(campaignTone(
      campaign({ kpi: null, performance: typed, resultTypes: ["PROFILE_VISITS"] }), projectKpis, SEPTEMBER,
    )).toBe("profitable");
  });
});
