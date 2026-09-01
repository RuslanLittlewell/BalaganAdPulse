import { describe, expect, it } from "vitest";
import {
  describeChanges,
  normalizeValue,
  parseDay,
  validateValue,
  type WritableProperty,
} from "../../src/modules/records/domain/value.js";

const money: WritableProperty = { id: "spend", name: "SPEND", type: "MONEY", formula: null };
const text: WritableProperty = { id: "note", name: "NOTE", type: "TEXT", formula: null };
const computed: WritableProperty = {
  id: "cpc", name: "CPC", type: "MONEY",
  formula: { kind: "const", value: "1" },
};

describe("a day", () => {
  it("is stored at UTC midnight, so it stays the same date in every timezone", () => {
    expect(parseDay("2026-09-01").toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
});

describe("validating a value", () => {
  it("accepts a decimal for a numeric column", () => {
    expect(() => validateValue(money, "150.5")).not.toThrow();
    expect(() => validateValue(money, "-3")).not.toThrow();
  });

  it("accepts any text for a text column", () => {
    expect(() => validateValue(text, "anything at all")).not.toThrow();
  });

  it("accepts null for either, because clearing a cell is ordinary", () => {
    expect(() => validateValue(money, null)).not.toThrow();
    expect(() => validateValue(text, null)).not.toThrow();
  });

  it("refuses text in a numeric column", () => {
    expect(() => validateValue(money, "lots")).toThrow(/numeric/);
    expect(() => validateValue(money, "1.2.3")).toThrow(/numeric/);
    expect(() => validateValue(money, "")).toThrow(/numeric/);
  });

  it("refuses any write to a computed column", () => {
    expect(() => validateValue(computed, "1")).toThrow(/computed/);
    expect(() => validateValue(computed, null)).toThrow(/computed/);
  });
});

describe("normalising a value", () => {
  it("stores numbers at four decimals so the table reads back exactly", () => {
    expect(normalizeValue(money, "150.5")).toBe("150.5000");
    expect(normalizeValue(money, "2")).toBe("2.0000");
  });

  it("leaves text alone", () => {
    expect(normalizeValue(text, " spaced ")).toBe(" spaced ");
  });

  it("leaves null alone", () => {
    expect(normalizeValue(money, null)).toBeNull();
    expect(normalizeValue(text, null)).toBeNull();
  });
});

describe("describing what a multi-cell write changed", () => {
  it("pairs each column's previous value with the new one", () => {
    const changes = describeChanges(
      [money, text],
      new Map([
        ["spend", { numberValue: "100.0000", textValue: null }],
        ["note", { numberValue: null, textValue: "before" }],
      ]),
      [{ propertyId: "spend", value: "150.5" }, { propertyId: "note", value: "after" }],
    );
    expect(changes).toEqual([
      { field: "SPEND", before: "100.0000", after: "150.5000" },
      { field: "NOTE", before: "before", after: "after" },
    ]);
  });

  it("reports a previously empty cell as null rather than omitting it", () => {
    const changes = describeChanges([money], new Map(), [{ propertyId: "spend", value: "1" }]);
    expect(changes).toEqual([{ field: "SPEND", before: null, after: "1.0000" }]);
  });

  it("reports a cleared cell as an after of null", () => {
    const changes = describeChanges(
      [money],
      new Map([["spend", { numberValue: "5.0000", textValue: null }]]),
      [{ propertyId: "spend", value: null }],
    );
    expect(changes).toEqual([{ field: "SPEND", before: "5.0000", after: null }]);
  });
});
