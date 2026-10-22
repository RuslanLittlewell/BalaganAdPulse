import { fitWidths, MIN_COLUMN_WIDTH } from "@/widgets/performance-table/columnWidths.js";

describe("fitWidths", () => {
  it("keeps the wanted widths when they fit, and when the room is unknown", () => {
    expect(fitWidths([128, 128], 300)).toEqual([128, 128]);
    expect(fitWidths([128, 128], 256)).toEqual([128, 128]);
    expect(fitWidths([128, 128], 0)).toEqual([128, 128]);
  });

  it("narrows every column in proportion until the columns fit", () => {
    const fitted = fitWidths([200, 100, 100], 300);
    expect(fitted).toEqual([150, 75, 75]);
    expect(fitted.reduce((sum, width) => sum + width, 0)).toBeLessThanOrEqual(300);
  });

  it("never narrows a column below the minimum", () => {
    expect(fitWidths([128, 128, 128], 150)).toEqual([MIN_COLUMN_WIDTH, MIN_COLUMN_WIDTH, MIN_COLUMN_WIDTH]);
  });
});
