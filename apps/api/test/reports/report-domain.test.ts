import { describe, expect, it } from "vitest";
import { costPerLead, relativeChange } from "../../src/modules/reports/domain/money.js";
import { hasEnded, latestEnded } from "../../src/modules/reports/domain/month.js";
import { computeFigures, describeFigures, suggestAds, type ReportRecord } from "../../src/modules/reports/domain/report.js";

const record = (overrides: Partial<ReportRecord>): ReportRecord => ({
  id: "r", projectId: "p", month: "2026-08", status: "DRAFT", currency: "USD",
  figures: { spend: "3080.7700", leads: 95, history: [{ month: "2026-07", spend: "3080.8500", leads: 69 }], ads: [] },
  computedAt: new Date(), leadsOverride: null, messengerContacts: null, conclusions: null, plan: null,
  adIds: [], publishedAt: null, createdAt: new Date(), updatedAt: new Date(),
  ...overrides,
});

describe("money", () => {
  it("divides spend by leads to four decimals, rounding half up", () => {
    expect(costPerLead("3080.7700", 95)).toBe("32.4292");
    expect(costPerLead("3080.7700", 90)).toBe("34.2308");
    expect(costPerLead("10.0000", 0)).toBeNull();
  });

  it("states a change as a fraction of the earlier value", () => {
    expect(relativeChange("95", "69")).toBe("0.3768");
    expect(relativeChange("65.8200", "75.6400")).toBe("-0.1298");
    expect(relativeChange("5", "0")).toBeNull();
  });
});

describe("a month has ended", () => {
  it("once the first of the next month has begun in every account's timezone", () => {
    const earlyFirstUtc = new Date("2026-09-01T02:00:00Z");
    expect(hasEnded("2026-08", [], earlyFirstUtc)).toBe(true);
    expect(hasEnded("2026-08", ["Europe/Warsaw"], earlyFirstUtc)).toBe(true);
    expect(hasEnded("2026-08", ["America/Chicago"], earlyFirstUtc)).toBe(false);
    expect(hasEnded("2026-08", ["Europe/Warsaw", "America/Chicago"], earlyFirstUtc)).toBe(false);
    expect(hasEnded("2026-08", ["America/Chicago"], new Date("2026-09-01T06:00:00Z"))).toBe(true);
    expect(hasEnded("2026-09", [], new Date("2026-09-20T12:00:00Z"))).toBe(false);
  });

  it("names the latest ended month", () => {
    expect(latestEnded([], new Date("2026-09-01T02:00:00Z"))).toBe("2026-08");
    expect(latestEnded(["America/Chicago"], new Date("2026-09-01T02:00:00Z"))).toBe("2026-07");
    expect(latestEnded([], new Date("2026-01-15T00:00:00Z"))).toBe("2025-12");
  });
});

describe("figures", () => {
  it("keep up to five earlier months from the first month with figures, zero-filled and corrected", () => {
    const figures = computeFigures({
      month: "2026-08",
      firstMonth: "2026-05",
      totals: [
        { month: "2026-05", spend: "100.0000", leads: 4 },
        { month: "2026-07", spend: "300.0000", leads: 10 },
        { month: "2026-08", spend: "400.0000", leads: 20 },
      ],
      corrections: new Map([["2026-07", 12]]),
      ads: [],
    });
    expect(figures).toEqual({
      spend: "400.0000",
      leads: 20,
      history: [
        { month: "2026-05", spend: "100.0000", leads: 4 },
        { month: "2026-06", spend: "0.0000", leads: 0 },
        { month: "2026-07", spend: "300.0000", leads: 12 },
      ],
      ads: [],
    });
  });

  it("stop at six months in all", () => {
    const figures = computeFigures({ month: "2026-08", firstMonth: "2025-01", totals: [], corrections: new Map(), ads: [] });
    expect(figures.history.map((entry) => entry.month)).toEqual(["2026-03", "2026-04", "2026-05", "2026-06", "2026-07"]);
  });

  it("suggest the three ads with most leads, ties to the lower spend, none without leads", () => {
    const ad = (adId: string, spend: string, leads: number) => ({ adId, name: adId, spend, leads });
    expect(suggestAds([ad("a", "50", 5), ad("b", "40", 9), ad("c", "30", 5), ad("d", "10", 0), ad("e", "90", 2)]))
      .toEqual(["b", "c", "a"]);
    expect(suggestAds([ad("d", "10", 0)])).toEqual([]);
  });

  it("follow a corrected lead count", () => {
    const described = describeFigures(record({ leadsOverride: 90 }));
    expect(described).toMatchObject({ leads: 90, costPerLead: "34.2308" });
    expect(described.trend.at(-1)).toMatchObject({ month: "2026-08", leads: 90 });
    expect(described.change.leads).toBe(relativeChange("90", "69"));
  });
});
