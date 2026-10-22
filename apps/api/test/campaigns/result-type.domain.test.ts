import { describe, expect, it } from "vitest";
import { resultTypeOfGoal, sumByType, typesOf } from "../../src/modules/campaigns/domain/result-type.js";

describe("the result type of an optimization goal", () => {
  it.each([
    ["CONVERSATIONS", "MESSAGES"],
    ["PROFILE_VISIT", "PROFILE_VISITS"],
    ["LEAD_GENERATION", "LEADS"],
    ["LINK_CLICKS", "LINK_CLICKS"],
    ["LANDING_PAGE_VIEWS", "LANDING_PAGE_VIEWS"],
    ["OFFSITE_CONVERSIONS", "CONVERSIONS"],
    ["POST_ENGAGEMENT", "ENGAGEMENT"],
    ["REACH", "REACH"],
    ["THRUPLAY", "VIDEO_VIEWS"],
    ["APP_INSTALLS", "APP_INSTALLS"],
  ])("%s is %s", (goal, type) => {
    expect(resultTypeOfGoal(goal)).toBe(type);
  });

  it("ignores the case of the goal", () => {
    expect(resultTypeOfGoal("conversations")).toBe("MESSAGES");
  });

  it("is other for a goal it does not know", () => {
    expect(resultTypeOfGoal("SOMETHING_NEW")).toBe("OTHER");
  });

  it.each([null, undefined, ""])("is unknown for %j", (goal) => {
    expect(resultTypeOfGoal(goal)).toBe("UNKNOWN");
  });
});

describe("summing figures by type", () => {
  it("adds results and spend of one type together", () => {
    expect(sumByType([
      { type: "MESSAGES", results: 100, spend: 2000 },
      { type: "MESSAGES", results: 20, spend: 500 },
    ])).toEqual([{ type: "MESSAGES", results: 120, spend: 2500 }]);
  });

  it("keeps different types apart, the largest first", () => {
    expect(sumByType([
      { type: "PROFILE_VISITS", results: 45, spend: 900 },
      { type: "MESSAGES", results: 120, spend: 3000 },
    ])).toEqual([
      { type: "MESSAGES", results: 120, spend: 3000 },
      { type: "PROFILE_VISITS", results: 45, spend: 900 },
    ]);
  });

  it("keeps a type that spent without results", () => {
    expect(sumByType([{ type: "LEADS", results: 0, spend: 300 }])).toEqual([{ type: "LEADS", results: 0, spend: 300 }]);
  });

  it("drops a type with neither results nor spend", () => {
    expect(sumByType([{ type: "LEADS", results: 0, spend: 0 }])).toEqual([]);
  });
});

describe("the types a campaign optimises for", () => {
  it("are the distinct types of its ad sets in a fixed order", () => {
    expect(typesOf([
      { campaignId: "c1", optimizationGoal: "PROFILE_VISIT" },
      { campaignId: "c1", optimizationGoal: "CONVERSATIONS" },
      { campaignId: "c1", optimizationGoal: "CONVERSATIONS" },
    ])).toEqual(["MESSAGES", "PROFILE_VISITS"]);
  });

  it("include unknown for an ad set without a goal", () => {
    expect(typesOf([{ campaignId: "c1", optimizationGoal: null }])).toEqual(["UNKNOWN"]);
  });
});
