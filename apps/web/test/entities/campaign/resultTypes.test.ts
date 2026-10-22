import { formatCount } from "@/shared/lib/index.js";
import {
  mergeResultTypeFigures,
  orderedResultTypes,
  resultsBreakdown,
  resultTypeFiguresOf,
  resultTypesText,
  totalPerformance,
  typedCost,
  typedResults,
} from "@/entities/campaign/index.js";

const figures = {
  resultTypes: [
    { type: "MESSAGES" as const, results: 120, spend: 3000 },
    { type: "LEADS" as const, results: 0, spend: 500 },
  ],
};

describe("merging figures by result type", () => {
  it("adds results and spend of the same type and orders the largest first", () => {
    expect(mergeResultTypeFigures([
      [{ type: "PROFILE_VISITS", results: 45, spend: 900 }, { type: "MESSAGES", results: 20, spend: 500 }],
      [{ type: "MESSAGES", results: 100, spend: 2500 }],
      undefined,
    ])).toEqual([
      { type: "MESSAGES", results: 120, spend: 3000 },
      { type: "PROFILE_VISITS", results: 45, spend: 900 },
    ]);
  });

  it("is carried by the totals of several campaigns", () => {
    const performance = (resultTypes: { type: "MESSAGES"; results: number; spend: number }[]) => ({
      spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, results: 0, revenue: 0, resultTypes,
    });
    expect(totalPerformance([
      performance([{ type: "MESSAGES", results: 10, spend: 100 }]),
      performance([{ type: "MESSAGES", results: 5, spend: 50 }]),
    ]).resultTypes).toEqual([{ type: "MESSAGES", results: 15, spend: 150 }]);
  });
});

describe("the figures of one type", () => {
  it("are its results", () => {
    expect(typedResults(figures, "MESSAGES")).toBe(120);
  });

  it("cost its spend over its results", () => {
    expect(typedCost(figures, "MESSAGES")).toBe(25);
  });

  it("have no cost without results", () => {
    expect(typedCost(figures, "LEADS")).toBeNull();
  });

  it("are nothing for a type the figures do not hold", () => {
    expect(typedResults(figures, "PROFILE_VISITS")).toBeNull();
    expect(typedCost(figures, "PROFILE_VISITS")).toBeNull();
  });

  it("fill a pair of columns per type", () => {
    expect(resultTypeFiguresOf(figures, ["MESSAGES", "PROFILE_VISITS"])).toEqual({
      "results.MESSAGES": 120,
      "costPerResult.MESSAGES": 25,
      "results.PROFILE_VISITS": null,
      "costPerResult.PROFILE_VISITS": null,
    });
  });
});

describe("ordering result types", () => {
  it("keeps each once in a fixed order", () => {
    expect(orderedResultTypes(["PROFILE_VISITS", "MESSAGES", "PROFILE_VISITS"])).toEqual(["MESSAGES", "PROFILE_VISITS"]);
  });
});

describe("naming result types", () => {
  it("joins their labels", () => {
    expect(resultTypesText(["MESSAGES", "PROFILE_VISITS"])).toBe("Сообщения, Переходы в профиль");
  });
});

describe("listing results by type", () => {
  it("lists each type with its count when there are two or more", () => {
    expect(resultsBreakdown([
      { type: "MESSAGES", results: 1200, spend: 0 },
      { type: "PROFILE_VISITS", results: 45, spend: 0 },
    ])).toBe(`Сообщения: ${formatCount(1200)} · Переходы в профиль: 45`);
  });

  it("lists nothing for one type", () => {
    expect(resultsBreakdown([{ type: "MESSAGES", results: 120, spend: 0 }])).toBeUndefined();
  });

  it("ignores a type that produced nothing", () => {
    expect(resultsBreakdown([
      { type: "MESSAGES", results: 120, spend: 0 },
      { type: "PROFILE_VISITS", results: 0, spend: 10 },
    ])).toBeUndefined();
  });
});
