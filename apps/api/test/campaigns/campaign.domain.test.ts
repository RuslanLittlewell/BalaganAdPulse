import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";
import { collectPropertyRefs, evaluate, type Expression } from "../../src/modules/campaigns/domain/expression.js";
import { assertFormulaIsValid, assertWritable, findDependents } from "../../src/modules/campaigns/domain/property.js";
import { computeTable } from "../../src/modules/campaigns/domain/table.js";

const prop = (propertyId: string): Expression => ({ kind: "property", propertyId });
const num = (value: string): Expression => ({ kind: "const", value });
const div = (left: Expression, right: Expression): Expression => ({ kind: "binary", op: "/", left, right });
const mul = (left: Expression, right: Expression): Expression => ({ kind: "binary", op: "*", left, right });

describe("evaluating an expression", () => {
  const resolve = (values: Record<string, string | null>) => (id: string) => {
    const value = values[id];
    return value === undefined || value === null ? null : new Decimal(value);
  };

  it("computes the four operations exactly, without float drift", () => {
    expect(evaluate({ kind: "binary", op: "+", left: num("0.1"), right: num("0.2") }, resolve({}))?.toString())
      .toBe("0.3");
    expect(evaluate({ kind: "binary", op: "-", left: num("1"), right: num("0.9") }, resolve({}))?.toString())
      .toBe("0.1");
    expect(evaluate(mul(num("1.5"), num("4")), resolve({}))?.toString()).toBe("6");
    expect(evaluate(div(num("10"), num("4")), resolve({}))?.toString()).toBe("2.5");
  });

  it("treats a division by zero as empty, because a day with no impressions is ordinary data", () => {
    expect(evaluate(div(num("10"), num("0")), resolve({}))).toBeNull();
  });

  it("is contagious about emptiness: one empty operand empties the whole expression", () => {
    expect(evaluate(mul(prop("a"), num("2")), resolve({ a: null }))).toBeNull();
    expect(evaluate(div(num("2"), prop("a")), resolve({ a: null }))).toBeNull();
  });

  it("collects every property it references, once each", () => {
    expect(collectPropertyRefs(mul(prop("a"), div(prop("b"), prop("a")))).sort()).toEqual(["a", "b"]);
  });
});

describe("formula invariants", () => {
  const refs = [
    { id: "spend", type: "MONEY" as const, formula: null },
    { id: "clicks", type: "NUMBER" as const, formula: null },
    { id: "comment", type: "TEXT" as const, formula: null },
    { id: "cpc", type: "MONEY" as const, formula: div(prop("spend"), prop("clicks")) },
  ];

  it("accepts a formula over numeric columns of the same campaign", () => {
    expect(() => assertFormulaIsValid("new", div(prop("spend"), prop("clicks")), refs)).not.toThrow();
  });

  it("refuses a formula that references its own column", () => {
    expect(() => assertFormulaIsValid("cpc", div(prop("cpc"), prop("clicks")), refs))
      .toThrow(/its own property/);
  });

  it("refuses a reference to a column of another campaign", () => {
    expect(() => assertFormulaIsValid("new", prop("elsewhere"), refs)).toThrow(/outside this campaign/);
  });

  it("refuses a reference to a text column", () => {
    expect(() => assertFormulaIsValid("new", prop("comment"), refs)).toThrow(/text property/);
  });

  it("refuses a cycle closed through another formula", () => {
    // `cpc` already reads `spend`; making `spend` read `cpc` closes the loop.
    expect(() => assertFormulaIsValid("spend", prop("cpc"), refs)).toThrow(/circular/);
  });

  it("finds the columns that depend on one, so a delete can explain itself", () => {
    expect(findDependents("spend", refs).map((property) => property.id)).toEqual(["cpc"]);
    expect(findDependents("comment", refs)).toEqual([]);
  });

  it("refuses a write to a computed column", () => {
    expect(() => assertWritable({ formula: null })).not.toThrow();
    expect(() => assertWritable({ formula: prop("spend") })).toThrow(/computed property/);
  });
});

describe("computing a table", () => {
  const properties = [
    { id: "spend", key: "spend", name: "SPEND", type: "MONEY" as const, position: 0, formula: null },
    { id: "clicks", key: "clicks", name: "CLICKS", type: "NUMBER" as const, position: 1, formula: null },
    { id: "cpc", key: "cpc", name: "CPC", type: "MONEY" as const, position: 2, formula: div(prop("spend"), prop("clicks")) },
    { id: "note", key: null, name: "NOTE", type: "TEXT" as const, position: 3, formula: null },
  ];
  const row = (id: string, date: string, spend: string | null, clicks: string | null, note: string | null = null) => ({
    id, date,
    storedValues: [
      { propertyId: "spend", numberValue: spend === null ? null : new Decimal(spend), textValue: null },
      { propertyId: "clicks", numberValue: clicks === null ? null : new Decimal(clicks), textValue: null },
      { propertyId: "note", numberValue: null, textValue: note },
    ],
  });

  it("returns every value as a string at four decimals", () => {
    const table = computeTable(properties, [row("r1", "2026-09-01", "100", "40")]);
    expect(table.records[0].values).toEqual({
      spend: "100.0000", clicks: "40.0000", cpc: "2.5000", note: null,
    });
  });

  it("carries text columns through untouched", () => {
    const table = computeTable(properties, [row("r1", "2026-09-01", "1", "1", "hello")]);
    expect(table.records[0].values.note).toBe("hello");
  });

  it("leaves a computed cell empty when an operand is missing", () => {
    const table = computeTable(properties, [row("r1", "2026-09-01", "100", null)]);
    expect(table.records[0].values.cpc).toBeNull();
  });

  it("sums entered columns and averages percentages for the totals", () => {
    const withPercent = [
      ...properties,
      { id: "ctr", key: "ctr", name: "CTR", type: "PERCENT" as const, position: 4, formula: null },
    ];
    const rows = [
      { ...row("r1", "2026-09-01", "100", "40"), storedValues: [
        ...row("r1", "2026-09-01", "100", "40").storedValues,
        { propertyId: "ctr", numberValue: new Decimal("10"), textValue: null },
      ] },
      { ...row("r2", "2026-09-02", "50", "10"), storedValues: [
        ...row("r2", "2026-09-02", "50", "10").storedValues,
        { propertyId: "ctr", numberValue: new Decimal("20"), textValue: null },
      ] },
    ];
    const table = computeTable(withPercent, rows);
    expect(table.totals.spend).toBe("150.0000");
    expect(table.totals.clicks).toBe("50.0000");
    expect(table.totals.ctr).toBe("15.0000");
  });

  it("computes a total for a formula column from the totals of its operands", () => {
    const table = computeTable(properties, [
      row("r1", "2026-09-01", "100", "40"),
      row("r2", "2026-09-02", "50", "10"),
    ]);
    // 150 / 50, not the average of the per-row CPCs.
    expect(table.totals.cpc).toBe("3.0000");
  });

  it("gives an empty column an empty total rather than zero", () => {
    const table = computeTable(properties, [row("r1", "2026-09-01", null, null)]);
    expect(table.totals.spend).toBeNull();
    expect(table.totals.note).toBeNull();
  });

  it("keeps the rows in the order it was given them", () => {
    const table = computeTable(properties, [
      row("r1", "2026-09-01", "1", "1"),
      row("r2", "2026-09-02", "2", "2"),
    ]);
    expect(table.records.map((record) => record.date)).toEqual(["2026-09-01", "2026-09-02"]);
  });
});
