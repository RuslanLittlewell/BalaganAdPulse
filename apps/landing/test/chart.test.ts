import { describe, expect, it } from "vitest";
import { chartPaths, leadsWord, nearestIndex } from "../src/scripts/chart";

describe("the chart's geometry", () => {
  it("spreads the points across the width and puts the highest value on top", () => {
    const { points } = chartPaths([10, 30, 20], 100, 50, 5);
    expect(points.map(([x]) => x)).toEqual([5, 50, 95]);
    expect(points[1][1]).toBe(5);
    expect(points[0][1]).toBe(45);
  });

  it("closes the area along the bottom", () => {
    const { area } = chartPaths([1, 2], 100, 50, 5);
    expect(area).toMatch(/ L95\.0,45 L5\.0,45 Z$/);
  });

  it("draws a flat line through equal values", () => {
    const { points } = chartPaths([4, 4, 4], 100, 50, 5);
    expect(new Set(points.map(([, y]) => y)).size).toBe(1);
  });
});

describe("the day under the pointer", () => {
  it("is the nearest point", () => {
    expect(nearestIndex([5, 50, 95], 40)).toBe(1);
    expect(nearestIndex([5, 50, 95], 0)).toBe(0);
    expect(nearestIndex([5, 50, 95], 200)).toBe(2);
  });
});

describe("the word for leads", () => {
  it("agrees with the number", () => {
    expect([1, 2, 5, 11, 21, 22, 33, 112].map(leadsWord))
      .toEqual(["лид", "лида", "лидов", "лидов", "лид", "лида", "лида", "лидов"]);
  });
});
