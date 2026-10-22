import {
  hasMixedResults,
  mergeResultTypeFigures,
  orderedResultTypes,
  resultTypeColumnLabel,
  resultTypeFiguresOf,
  totalPerformance,
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

  it("are nothing for a type the figures do not hold", () => {
    expect(typedResults(figures, "PROFILE_VISITS")).toBeNull();
  });

  it("fill one column per type", () => {
    expect(resultTypeFiguresOf(figures, ["MESSAGES", "PROFILE_VISITS"])).toEqual({
      "results.MESSAGES": 120,
      "results.PROFILE_VISITS": null,
    });
  });

  it("name their column after the results", () => {
    expect(resultTypeColumnLabel("MESSAGES")).toBe("Результаты - Сообщения");
  });
});

describe("ordering result types", () => {
  it("keeps each once in a fixed order", () => {
    expect(orderedResultTypes(["PROFILE_VISITS", "MESSAGES", "PROFILE_VISITS"])).toEqual(["MESSAGES", "PROFILE_VISITS"]);
  });
});

describe("mixed results", () => {
  it("are results of two or more types", () => {
    expect(hasMixedResults([
      { type: "MESSAGES", results: 1200, spend: 0 },
      { type: "PROFILE_VISITS", results: 45, spend: 0 },
    ])).toBe(true);
  });

  it("are not results of one type", () => {
    expect(hasMixedResults([{ type: "MESSAGES", results: 120, spend: 0 }])).toBe(false);
  });

  it("ignore a type that produced nothing", () => {
    expect(hasMixedResults([
      { type: "MESSAGES", results: 120, spend: 0 },
      { type: "PROFILE_VISITS", results: 0, spend: 10 },
    ])).toBe(false);
  });
});
