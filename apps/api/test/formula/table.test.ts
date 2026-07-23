import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { computeTable, type TableProperty, type TableRecord } from "../../src/formula/table.js";
import type { Expression } from "../../src/formula/expression.schema.js";

const SPEND = "11111111-1111-1111-1111-111111111111";
const IMPRESSIONS = "22222222-2222-2222-2222-222222222222";
const CLICKS = "33333333-3333-3333-3333-333333333333";
const CTR = "44444444-4444-4444-4444-444444444444";
const COMMENT = "55555555-5555-5555-5555-555555555555";
const RATE = "66666666-6666-6666-6666-666666666666";

const col = (propertyId: string): Expression => ({ kind: "property", propertyId });
const ctrFormula: Expression = {
  kind: "binary", op: "*",
  left: { kind: "binary", op: "/", left: col(CLICKS), right: col(IMPRESSIONS) },
  right: { kind: "const", value: "100" },
};

const properties: TableProperty[] = [
  { id: SPEND, key: "spend", name: "SPEND", type: "MONEY", position: 0, formula: null },
  { id: IMPRESSIONS, key: "impressions", name: "IMPRESSIONS", type: "NUMBER", position: 1, formula: null },
  { id: CLICKS, key: "clicks", name: "CLICKS", type: "NUMBER", position: 2, formula: null },
  { id: CTR, key: "ctr", name: "CTR", type: "PERCENT", position: 3, formula: ctrFormula },
  { id: COMMENT, key: "comment", name: "COMMENT", type: "TEXT", position: 4, formula: null },
  { id: RATE, key: null, name: "RATE", type: "PERCENT", position: 5, formula: null },
];

function record(id: string, date: string, values: Record<string, string | null>, text?: string): TableRecord {
  return {
    id,
    date: new Date(`${date}T00:00:00.000Z`),
    storedValues: [
      ...Object.entries(values).map(([propertyId, value]) => ({
        propertyId,
        numberValue: value === null ? null : new Prisma.Decimal(value),
        textValue: null,
      })),
      ...(text === undefined ? [] : [{ propertyId: COMMENT, numberValue: null, textValue: text }]),
    ],
  };
}

describe("computeTable", () => {
  it("computes derived values and passes entered ones through", () => {
    const table = computeTable(properties, [
      record("r1", "2026-07-21", { [SPEND]: "150.5", [IMPRESSIONS]: "1000", [CLICKS]: "25" }, "good day"),
    ]);
    expect(table.records[0].date).toBe("2026-07-21");
    expect(table.records[0].values[SPEND]).toBe("150.5000");
    expect(table.records[0].values[CTR]).toBe("2.5000");
    expect(table.records[0].values[COMMENT]).toBe("good day");
  });

  it("computes an untouched day as nulls everywhere", () => {
    const table = computeTable(properties, [record("r1", "2026-07-21", {})]);
    for (const property of properties) expect(table.records[0].values[property.id]).toBeNull();
  });

  it("computes derived totals from the sums, not from the daily averages", () => {
    const table = computeTable(properties, [
      record("r1", "2026-07-21", { [IMPRESSIONS]: "1000", [CLICKS]: "10" }),
      record("r2", "2026-07-22", { [IMPRESSIONS]: "900", [CLICKS]: "90" }),
    ]);
    // Daily CTRs differ (1% and 10%), so a naive average-of-daily-values would give
    // (1 + 10) / 2 = 5.5%. The correct weighted total evaluates the formula over the
    // summed operands: Σ clicks / Σ impressions = 100 / 1900 = 5.263157...%, which
    // rounds to 5.2632 — distinct from the naive average, so this test actually
    // distinguishes the two behaviors.
    expect(table.totals[CTR]).toBe("5.2632");
    expect(table.totals[IMPRESSIONS]).toBe("1900.0000");
  });

  it("sums money properties and averages entered percent properties", () => {
    const table = computeTable(properties, [
      record("r1", "2026-07-21", { [SPEND]: "100.25", [RATE]: "10" }),
      record("r2", "2026-07-22", { [SPEND]: "200.25", [RATE]: "20" }),
    ]);
    expect(table.totals[SPEND]).toBe("300.5000");
    expect(table.totals[RATE]).toBe("15.0000");
  });

  it("leaves text totals null", () => {
    const table = computeTable(properties, [record("r1", "2026-07-21", {}, "note")]);
    expect(table.totals[COMMENT]).toBeNull();
  });

  it("returns null totals for a campaign with no records", () => {
    const table = computeTable(properties, []);
    expect(table.records).toEqual([]);
    for (const property of properties) expect(table.totals[property.id]).toBeNull();
  });
});
