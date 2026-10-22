import { describe, expect, it } from "vitest";
import { resultTypeOfGoal, resultsByType } from "../../src/modules/campaigns/domain/result-type.js";

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

describe("a campaign's results by type", () => {
  const adSet = (adSetId: string, optimizationGoal: string | null, results: number) =>
    ({ adSetId, campaignId: "c1", optimizationGoal, results });

  it("adds the ad sets of one type together", () => {
    expect(resultsByType([adSet("a", "CONVERSATIONS", 100), adSet("b", "CONVERSATIONS", 20)]))
      .toEqual([{ type: "MESSAGES", results: 120 }]);
  });

  it("keeps different types apart, the largest first", () => {
    expect(resultsByType([adSet("a", "PROFILE_VISIT", 45), adSet("b", "CONVERSATIONS", 120)]))
      .toEqual([{ type: "MESSAGES", results: 120 }, { type: "PROFILE_VISITS", results: 45 }]);
  });

  it("keeps a type that produced nothing", () => {
    expect(resultsByType([adSet("a", "CONVERSATIONS", 0)])).toEqual([{ type: "MESSAGES", results: 0 }]);
  });

  it("files an ad set without a goal under unknown", () => {
    expect(resultsByType([adSet("a", null, 7)])).toEqual([{ type: "UNKNOWN", results: 7 }]);
  });
});
