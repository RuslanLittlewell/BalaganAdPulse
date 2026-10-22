import { formatCount } from "@/shared/lib/index.js";
import { mergeResultTypes, resultsBreakdown, resultTypesText } from "@/entities/campaign/index.js";

describe("merging the result types of campaigns", () => {
  it("adds the same type together and orders the largest first", () => {
    expect(mergeResultTypes([
      [{ type: "PROFILE_VISITS", results: 45 }, { type: "MESSAGES", results: 20 }],
      [{ type: "MESSAGES", results: 100 }],
    ])).toEqual([{ type: "MESSAGES", results: 120 }, { type: "PROFILE_VISITS", results: 45 }]);
  });

  it("is empty for no campaigns", () => {
    expect(mergeResultTypes([])).toEqual([]);
  });
});

describe("naming result types", () => {
  it("joins their labels", () => {
    expect(resultTypesText([{ type: "MESSAGES", results: 1 }, { type: "PROFILE_VISITS", results: 1 }]))
      .toBe("Сообщения, Переходы в профиль");
  });
});

describe("listing results by type", () => {
  it("lists each type with its count when there are two or more", () => {
    expect(resultsBreakdown([{ type: "MESSAGES", results: 1200 }, { type: "PROFILE_VISITS", results: 45 }]))
      .toBe(`Сообщения: ${formatCount(1200)} · Переходы в профиль: 45`);
  });

  it("lists nothing for one type", () => {
    expect(resultsBreakdown([{ type: "MESSAGES", results: 120 }])).toBeUndefined();
  });

  it("ignores a type that produced nothing", () => {
    expect(resultsBreakdown([{ type: "MESSAGES", results: 120 }, { type: "PROFILE_VISITS", results: 0 }]))
      .toBeUndefined();
  });
});
