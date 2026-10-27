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
    expect(campaignTone(campaign({ performance: { ...performance, conversions } }), SEPTEMBER)).toBe(tone);
  });

  it("counts a lower-is-better KPI in its favourable direction", () => {
    const cpaOf = (cpa: number) => campaignTone(
      campaign({ kpi: { metric: "CPA", target: "10.0000" }, performance: { ...performance, cpa } }),
      SEPTEMBER,
    );

    expect(cpaOf(9)).toBe("profitable");
    expect(cpaOf(12)).toBe("stable");
    expect(cpaOf(15)).toBe("danger");
  });

  it("is grey without a KPI of its own", () => {
    expect(campaignTone(campaign({ kpi: null }), SEPTEMBER)).toBe("idle");
  });

  it("is grey when the KPI's figure is not measured", () => {
    const unmeasured = campaign({ kpi: { metric: "CPA", target: "10.0000" }, performance: { ...performance, cpa: null } });
    expect(campaignTone(unmeasured, SEPTEMBER)).toBe("idle");
  });

  it.each(["PAUSED", "REJECTED", "ENDED"] as const)("is grey for a %s campaign, whatever its figures", (status) => {
    expect(campaignTone(campaign({ status }), SEPTEMBER)).toBe("idle");
  });

  it("counts a learning campaign as running", () => {
    expect(campaignTone(campaign({ status: "LEARNING" }), SEPTEMBER)).toBe("profitable");
  });
});
