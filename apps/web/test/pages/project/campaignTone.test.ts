import { campaignTone } from "@/pages/project/campaignTone.js";

const SEPTEMBER = { from: "2026-09-01", to: "2026-09-30" };

const performance = {
  spend: 1000, impressions: 100000, reach: 40000, clicks: 2000, conversions: 30, revenue: 4000,
  ctr: 2, cpc: 0.5, cpm: 10, cpa: 10, roas: 4, frequency: 2.5,
};

const campaign = (overrides: Partial<Parameters<typeof campaignTone>[0]> = {}) => ({
  status: "ACTIVE" as const,
  kpi: { metric: "CONVERSIONS", target: "30.0000" },
  performance,
  ...overrides,
});

describe("a campaign's indicator", () => {
  it.each([
    [30, "profitable"],
    [45, "profitable"],
    [27, "stable"],
    [24, "stable"],
    [23, "danger"],
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
    expect(cpaOf(14)).toBe("danger");
  });

  it("falls back to the project's KPI when the campaign has none", () => {
    const projectKpi = { metric: "CONVERSIONS" as const, target: "20.0000" };
    expect(campaignTone(campaign({ kpi: null }), projectKpi, SEPTEMBER)).toBe("profitable");
  });

  it("prefers the campaign's own KPI over the project's", () => {
    const projectKpi = { metric: "CONVERSIONS" as const, target: "10.0000" };
    expect(campaignTone(campaign({ kpi: { metric: "CONVERSIONS", target: "100.0000" } }), projectKpi, SEPTEMBER)).toBe("danger");
  });

  it("is grey without any KPI", () => {
    expect(campaignTone(campaign({ kpi: null }), null, SEPTEMBER)).toBe("idle");
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
});
