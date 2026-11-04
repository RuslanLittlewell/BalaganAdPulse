import { describe, expect, it } from "vitest";
import { foldBoardStageCounts, type StageGroup } from "../../src/modules/leads/domain/lead.js";

const ZERO = { NEW: 0, QUALIFIED: 0, TARGET: 0, PROPOSAL: 0 };

describe("folding stage groups into campaign, ad set and ad counts", () => {
  it("sums the ads of one ad set and keeps a lead without an ad on its campaign", () => {
    const groups: StageGroup[] = [
      { campaignId: "c1", adId: "a1", stage: "TARGET", count: 2 },
      { campaignId: "c1", adId: "a2", stage: "TARGET", count: 1 },
      { campaignId: "c1", adId: "a2", stage: "QUALIFIED", count: 1 },
      { campaignId: "c1", adId: null, stage: "NEW", count: 4 },
    ];

    expect(foldBoardStageCounts(groups, new Map([["a1", "s1"], ["a2", "s1"]]))).toEqual({
      campaigns: [{ campaignId: "c1", ...ZERO, NEW: 4, QUALIFIED: 1, TARGET: 3 }],
      adSets: [{ adSetId: "s1", ...ZERO, QUALIFIED: 1, TARGET: 3 }],
      ads: [
        { adId: "a1", ...ZERO, TARGET: 2 },
        { adId: "a2", ...ZERO, QUALIFIED: 1, TARGET: 1 },
      ],
    });
  });

  it("counts a lead that names no campaign nowhere", () => {
    const groups: StageGroup[] = [{ campaignId: null, adId: null, stage: "PROPOSAL", count: 3 }];

    expect(foldBoardStageCounts(groups, new Map())).toEqual({ campaigns: [], adSets: [], ads: [] });
  });

  it("leaves an ad whose ad set is unknown out of the ad sets only", () => {
    const groups: StageGroup[] = [{ campaignId: "c1", adId: "a9", stage: "NEW", count: 1 }];

    const folded = foldBoardStageCounts(groups, new Map());

    expect(folded.adSets).toEqual([]);
    expect(folded.ads).toEqual([{ adId: "a9", ...ZERO, NEW: 1 }]);
    expect(folded.campaigns).toEqual([{ campaignId: "c1", ...ZERO, NEW: 1 }]);
  });

  it("lists every group by id", () => {
    const groups: StageGroup[] = [
      { campaignId: "c2", adId: "a2", stage: "NEW", count: 1 },
      { campaignId: "c1", adId: "a1", stage: "NEW", count: 1 },
    ];

    const folded = foldBoardStageCounts(groups, new Map([["a2", "s2"], ["a1", "s1"]]));

    expect(folded.campaigns.map(({ campaignId }) => campaignId)).toEqual(["c1", "c2"]);
    expect(folded.adSets.map(({ adSetId }) => adSetId)).toEqual(["s1", "s2"]);
    expect(folded.ads.map(({ adId }) => adId)).toEqual(["a1", "a2"]);
  });
});
