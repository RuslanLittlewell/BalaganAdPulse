import { EMPTY_PERFORMANCE, totalPerformance, type Performance } from "@/entities/campaign/index.js";

const measured = (figures: Partial<Performance>): Performance => ({ ...EMPTY_PERFORMANCE, ...figures });

describe("the total of a set of campaigns", () => {
  it("sums the measured figures and derives every ratio from the sums", () => {
    const total = totalPerformance([
      measured({ spend: 200, impressions: 10000, reach: 5000, clicks: 100, conversions: 4, revenue: 1000, roas: 5 }),
      measured({ spend: 800, impressions: 30000, reach: 10000, clicks: 300, conversions: 16, revenue: 1000, roas: 1.25 }),
    ]);

    expect(total).toEqual({
      spend: 1000, impressions: 40000, reach: 15000, clicks: 400, conversions: 20, revenue: 2000,
      ctr: 1, cpc: 2.5, cpm: 25, cpa: 50, roas: 2, frequency: 40000 / 15000,
    });
  });

  it("leaves a ratio absent when its divisor sums to zero", () => {
    const total = totalPerformance([measured({ spend: 300, impressions: 1000, reach: 400 })]);

    expect(total.cpc).toBeNull();
    expect(total.cpa).toBeNull();
    expect(total.cpm).toBe(300);
  });

  it("totals nothing as zero figures and absent ratios", () => {
    expect(totalPerformance([])).toEqual(EMPTY_PERFORMANCE);
  });
});
