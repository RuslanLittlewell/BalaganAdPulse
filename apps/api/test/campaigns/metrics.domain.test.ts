import { describe, expect, it } from "vitest";
import {
  EMPTY_MEASURED,
  derive,
  sumByDay,
  sumMeasured,
  type Measured,
  type MeasuredDay,
} from "../../src/modules/campaigns/domain/metrics.js";

const day = (partial: Partial<Measured> = {}): Measured => ({
  spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, revenue: 0, ...partial,
});

describe("summing what was measured", () => {
  it("adds every figure across the days", () => {
    const total = sumMeasured([
      day({ spend: 100, impressions: 1000, reach: 800, clicks: 20, conversions: 2, revenue: 400 }),
      day({ spend: 50, impressions: 500, reach: 450, clicks: 5, conversions: 1, revenue: 150 }),
    ]);

    expect(total).toEqual({
      spend: 150, impressions: 1500, reach: 1250, clicks: 25, conversions: 3, revenue: 550,
    });
  });

  it("sums an empty range to zero, not to nothing", () => {
    expect(sumMeasured([])).toEqual(EMPTY_MEASURED);
  });

  it("lets a day with no row contribute nothing", () => {
    const withGap = sumMeasured([day({ spend: 100 }), day(), day({ spend: 40 })]);
    expect(withGap.spend).toBe(140);
  });
});

describe("deriving the ratios", () => {
  const measured = day({
    spend: 1000, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50, revenue: 4000,
  });

  it("derives each ratio from the figures", () => {
    const d = derive(measured);

    expect(d.ctr).toBeCloseTo(2, 10);
    expect(d.cpc).toBeCloseTo(0.5, 10);
    expect(d.cpm).toBeCloseTo(10, 10);
    expect(d.cpa).toBeCloseTo(20, 10);
    expect(d.roas).toBeCloseTo(4, 10);
    expect(d.frequency).toBeCloseTo(2.5, 10);
  });

  it.each([
    ["ctr", day({ spend: 100 })],
    ["cpc", day({ spend: 100 })],
    ["cpm", day({ spend: 100 })],
    ["cpa", day({ spend: 100 })],
    ["roas", day({ revenue: 100 })],
    ["frequency", day({ impressions: 100 })],
  ] as const)("reports %s as absent when its divisor is zero", (ratio, figures) => {
    expect(derive(figures)[ratio]).toBeNull();
  });

  it("reports a real zero when the dividend is zero but the divisor is not", () => {
    const d = derive(day({ spend: 500, impressions: 1000, clicks: 0 }));
    expect(d.ctr).toBe(0);
    expect(d.cpc).toBeNull();
  });

  it("derives a range's ratio from the summed figures, not by averaging days", () => {
    const days = [
      day({ impressions: 1000, clicks: 100 }),   // 10%
      day({ impressions: 9000, clicks: 90 }),    // 1%
    ];

    const derived = derive(sumMeasured(days)).ctr;

    expect(derived).toBeCloseTo(1.9, 10);
    const averaged = (10 + 1) / 2;
    expect(derived).not.toBeCloseTo(averaged, 5);
  });
});

describe("summing days by date", () => {
  const day = (date: string, spend: number, clicks = 0): MeasuredDay => ({
    ...EMPTY_MEASURED, date: new Date(`${date}T00:00:00.000Z`), spend, clicks,
  });

  it("adds the same date from several sources into one day", () => {
    const summed = sumByDay([day("2026-08-01", 100, 5), day("2026-08-01", 40, 3)]);

    expect(summed).toHaveLength(1);
    expect(summed[0].spend).toBe(140);
    expect(summed[0].clicks).toBe(8);
  });

  it("orders the days oldest first, whatever order they arrived in", () => {
    const summed = sumByDay([day("2026-08-03", 3), day("2026-08-01", 1), day("2026-08-02", 2)]);

    expect(summed.map((entry) => entry.spend)).toEqual([1, 2, 3]);
  });

  it("leaves a date with nothing measured out rather than inventing a zero", () => {
    const summed = sumByDay([day("2026-08-01", 1), day("2026-08-03", 3)]);

    expect(summed.map((entry) => entry.date.toISOString().slice(0, 10)))
      .toEqual(["2026-08-01", "2026-08-03"]);
  });

  it("answers an empty list for no days at all", () => {
    expect(sumByDay([])).toEqual([]);
  });
});
