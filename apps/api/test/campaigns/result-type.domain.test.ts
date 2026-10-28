import { describe, expect, it } from "vitest";
import {
  resultTypeOfCategory,
  resultTypeOfGoal,
  sumByType,
  typedByCategory,
  typesOf,
  typesOfCategories,
} from "../../src/modules/campaigns/domain/result-type.js";

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

describe("the result type of a Google conversion category", () => {
  it.each([
    ["SUBMIT_LEAD_FORM", "LEADS"], ["IMPORTED_LEAD", "LEADS"], ["REQUEST_QUOTE", "LEADS"],
    ["QUALIFIED_LEAD", "QUALIFIED_LEADS"], ["CONVERTED_LEAD", "QUALIFIED_LEADS"],
    ["PHONE_CALL_LEAD", "CALLS"], ["CONTACT", "CONTACTS"], ["BOOK_APPOINTMENT", "APPOINTMENTS"],
    ["GET_DIRECTIONS", "DIRECTIONS"], ["PURCHASE", "PURCHASES"], ["STORE_SALE", "PURCHASES"],
    ["SUBSCRIBE_PAID", "PURCHASES"], ["ADD_TO_CART", "CHECKOUTS"], ["BEGIN_CHECKOUT", "CHECKOUTS"],
    ["SIGNUP", "SIGNUPS"], ["PAGE_VIEW", "LANDING_PAGE_VIEWS"], ["OUTBOUND_CLICK", "LINK_CLICKS"],
    ["ENGAGEMENT", "ENGAGEMENT"], ["DOWNLOAD", "APP_INSTALLS"], ["DEFAULT", "OTHER"], ["STORE_VISIT", "OTHER"],
  ])("reads %s as %s", (category, type) => {
    expect(resultTypeOfCategory(category)).toBe(type);
  });

  it("names each type of an account's categories once, in the order of the types", () => {
    expect(typesOfCategories(["CONTACT", "SUBMIT_LEAD_FORM", "PHONE_CALL_LEAD", "IMPORTED_LEAD"]))
      .toEqual(["LEADS", "CALLS", "CONTACTS"]);
  });
});

describe("a Google entity's figures by category", () => {
  const day = (date: string) => new Date(`${date}T00:00:00Z`);

  it("gives every type each day's whole spend, and adds categories of one type together", () => {
    const figures = typedByCategory(
      [{ date: day("2026-08-02"), spend: 300 }, { date: day("2026-08-03"), spend: 100 }],
      [
        { date: day("2026-08-02"), category: "SUBMIT_LEAD_FORM", results: 1 },
        { date: day("2026-08-02"), category: "IMPORTED_LEAD", results: 3 },
      ],
      ["LEADS", "CALLS"],
    );

    expect(sumByType(figures)).toEqual([
      { type: "LEADS", results: 4, spend: 400 },
      { type: "CALLS", results: 0, spend: 400 },
    ]);
  });

  it("adds a type its results hold beyond the account's categories", () => {
    const figures = typedByCategory([], [{ date: day("2026-08-02"), category: "PURCHASE", results: 1 }], ["LEADS"]);

    expect(sumByType(figures)).toEqual([{ type: "PURCHASES", results: 1, spend: 0 }]);
  });
});
