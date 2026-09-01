import {
  formatCompactCount,
  formatCount,
  formatCurrency,
  formatMultiple,
  formatPercent,
  formatRatio,
  areaPath,
  linePath,
} from "@/shared/lib/metrics.js";

/** Figures group with a non-breaking space and never wrap away from their
 * unit, so the expectations spell it out rather than hiding it in a literal. */
const NBSP = "\u00A0";


describe("formatting measured figures", () => {
  it("renders money with the rouble sign and no kopecks", () => {
    expect(formatCurrency(1284500)).toBe(`1${NBSP}284${NBSP}500${NBSP}₽`);
    expect(formatCurrency(0)).toBe(`0${NBSP}₽`);
  });

  // A media buyer reads spend to the rouble; kopecks are noise at this scale.
  it("rounds money to whole roubles", () => {
    expect(formatCurrency(1284.6)).toBe(`1${NBSP}285${NBSP}₽`);
  });

  it("renders counts grouped and whole", () => {
    expect(formatCount(1284500)).toBe(`1${NBSP}284${NBSP}500`);
    expect(formatCount(0)).toBe("0");
  });

  it("shortens a large count where the column is narrow", () => {
    expect(formatCompactCount(1284500)).toBe(`1,28${NBSP}млн`);
    expect(formatCompactCount(12845)).toBe(`12,8${NBSP}тыс.`);
    expect(formatCompactCount(845)).toBe("845");
  });

  it("renders a percentage with two decimals", () => {
    expect(formatPercent(2)).toBe("2,00%");
    expect(formatPercent(0.125)).toBe("0,13%");
  });

  it("renders a cost ratio to two decimals with the rouble sign", () => {
    expect(formatRatio(0.5)).toBe(`0,50${NBSP}₽`);
    expect(formatRatio(24.375)).toBe(`24,38${NBSP}₽`);
  });

  it("renders a multiple with an x", () => {
    expect(formatMultiple(4)).toBe("4,00x");
    expect(formatMultiple(2.5)).toBe("2,50x");
  });
});

// A ratio with no divisor is absent, not zero: nothing was measured, so
// rendering "0" would claim a result the platforms never reported.
describe("an absent figure", () => {
  it("renders a dash for every formatter", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCount(null)).toBe("—");
    expect(formatCompactCount(null)).toBe("—");
    expect(formatPercent(null)).toBe("—");
    expect(formatRatio(null)).toBe("—");
    expect(formatMultiple(null)).toBe("—");
  });

  it("renders a dash for a figure that is not a number", () => {
    expect(formatPercent(Number.NaN)).toBe("—");
    expect(formatCurrency(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("chart paths", () => {
  const box = { width: 100, height: 40 };

  it("draws a line across the full width, highest value at the top", () => {
    expect(linePath([0, 5, 10], box)).toBe("M0,40 L50,20 L100,0");
  });

  it("closes the area back along the baseline", () => {
    expect(areaPath([0, 10], box)).toBe("M0,40 L100,0 L100,40 L0,40 Z");
  });

  // Every value equal has no range to scale by; drawing it at the bottom would
  // read as "nothing happened" when the figure was steady and high.
  it("draws a flat series through the middle", () => {
    expect(linePath([7, 7, 7], box)).toBe("M0,20 L50,20 L100,20");
  });

  it("draws nothing for an empty series", () => {
    expect(linePath([], box)).toBe("");
    expect(areaPath([], box)).toBe("");
  });

  it("draws a single point as a flat line", () => {
    expect(linePath([3], box)).toBe("M0,20 L100,20");
  });
});
