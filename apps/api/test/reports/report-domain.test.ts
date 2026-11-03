import { describe, expect, it } from "vitest";
import { costPerLead, fourDecimals, relativeChange } from "../../src/modules/reports/domain/money.js";
import { hasEnded, latestEnded } from "../../src/modules/reports/domain/month.js";
import {
  computeFigures, contactsOf, defaultContactsSource, describeFigures, suggestAds, type ReportRecord,
} from "../../src/modules/reports/domain/report.js";

const record = (overrides: Partial<ReportRecord>): ReportRecord => ({
  id: "r", projectId: "p", month: "2026-08", status: "DRAFT", currency: "USD",
  figures: { spend: "3080.7700", leads: 95, history: [{ month: "2026-07", spend: "3080.8500", leads: 69 }], ads: [] },
  computedAt: new Date(), leadsOverride: null, messengerContacts: null, contactsSource: null, conclusions: null, plan: null,
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

  it("writes an entered amount with four decimals", () => {
    expect(fourDecimals("900")).toBe("900.0000");
    expect(fourDecimals("12.5")).toBe("12.5000");
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
      entries: new Map(),
      ads: [],
      results: [],
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
      results: [],
    });
  });

  it("stop at six months in all", () => {
    const figures = computeFigures({
      month: "2026-08", firstMonth: "2025-01", totals: [], corrections: new Map(), entries: new Map(), ads: [], results: [],
    });
    expect(figures.history.map((entry) => entry.month)).toEqual(["2026-03", "2026-04", "2026-05", "2026-06", "2026-07"]);
  });

  it("keep the month's results per type that are above zero", () => {
    const figures = computeFigures({
      month: "2026-08", firstMonth: "2026-08", totals: [], corrections: new Map(), entries: new Map(), ads: [],
      results: [{ type: "MESSAGES", results: 105 }, { type: "CALLS", results: 12 }, { type: "REACH", results: 0 }],
    });
    expect(figures.results).toEqual([{ type: "MESSAGES", results: 105 }, { type: "CALLS", results: 12 }]);
  });

  it("start at the earliest entered month, with no spend where neither data nor entry has one", () => {
    const figures = computeFigures({
      month: "2026-10",
      firstMonth: "2026-09",
      totals: [{ month: "2026-09", spend: "1200.0000", leads: 58 }, { month: "2026-10", spend: "1300.0000", leads: 70 }],
      corrections: new Map(),
      entries: new Map([
        ["2026-06", { leads: 40, spend: "900.0000" }],
        ["2026-07", { leads: 52, spend: null }],
      ]),
      ads: [],
      results: [],
    });
    expect(figures.history).toEqual([
      { month: "2026-06", spend: "900.0000", leads: 40 },
      { month: "2026-07", spend: null, leads: 52 },
      { month: "2026-08", spend: null, leads: 0 },
      { month: "2026-09", spend: "1200.0000", leads: 58 },
    ]);
    const trend = describeFigures(record({ month: "2026-10", figures })).trend;
    expect(trend.map((point) => point.costPerLead)).toEqual(["22.5000", null, null, "20.6897", "18.5714"]);
  });

  it("prefer an entered month over the synced count and over a report's correction", () => {
    const figures = computeFigures({
      month: "2026-10",
      firstMonth: "2026-06",
      totals: [{ month: "2026-09", spend: "1200.0000", leads: 58 }],
      corrections: new Map([["2026-09", 60]]),
      entries: new Map([["2026-09", { leads: 64, spend: null }]]),
      ads: [],
      results: [],
    });
    expect(figures.history.at(-1)).toEqual({ month: "2026-09", spend: "1200.0000", leads: 64 });
  });

  it("ignore an entry outside the five months before the report's month", () => {
    const figures = computeFigures({
      month: "2026-10", firstMonth: null, totals: [], corrections: new Map(),
      entries: new Map([["2026-04", { leads: 9, spend: null }]]), ads: [], results: [],
    });
    expect(figures.history).toEqual([]);
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

describe("the fourth figure", () => {
  const figures = {
    spend: "100.0000", leads: 5, history: [], ads: [],
    results: [{ type: "MESSAGES", results: 105 }, { type: "CALLS", results: 12 }],
  };

  it("starts on messages when the month has any", () => {
    expect(defaultContactsSource(figures)).toBe("MESSAGES");
    expect(defaultContactsSource({ ...figures, results: [{ type: "CALLS", results: 12 }] })).toBeNull();
    expect(defaultContactsSource({ spend: "0.0000", leads: 0, history: [], ads: [] })).toBeNull();
  });

  it("shows the chosen type's total, zero once the type is gone, or the count entered by hand", () => {
    expect(contactsOf(record({ figures, contactsSource: "CALLS", messengerContacts: 40 }))).toBe(12);
    expect(contactsOf(record({ figures, contactsSource: "PROFILE_VISITS" }))).toBe(0);
    expect(contactsOf(record({ figures, contactsSource: null, messengerContacts: 40 }))).toBe(40);
  });
});
