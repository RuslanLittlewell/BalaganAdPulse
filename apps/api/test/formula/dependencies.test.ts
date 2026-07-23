import { describe, it, expect } from "vitest";
import {
  collectPropertyRefs, assertFormulaIsValid, findDependents, type PropertyRef,
} from "../../src/formula/dependencies.js";
import type { Expression } from "../../src/formula/expression.schema.js";
import { ValidationError } from "../../src/errors.js";

const SPEND = "11111111-1111-1111-1111-111111111111";
const CLICKS = "22222222-2222-2222-2222-222222222222";
const CPC = "33333333-3333-3333-3333-333333333333";
const COMMENT = "44444444-4444-4444-4444-444444444444";
const NEW = "55555555-5555-5555-5555-555555555555";

const col = (propertyId: string): Expression => ({ kind: "property", propertyId });
const div = (left: Expression, right: Expression): Expression =>
  ({ kind: "binary", op: "/", left, right });

const properties: PropertyRef[] = [
  { id: SPEND, type: "MONEY", formula: null },
  { id: CLICKS, type: "NUMBER", formula: null },
  { id: CPC, type: "MONEY", formula: div(col(SPEND), col(CLICKS)) },
  { id: COMMENT, type: "TEXT", formula: null },
];

describe("collectPropertyRefs", () => {
  it("collects every referenced property once", () => {
    expect(collectPropertyRefs(div(col(SPEND), col(SPEND))).sort()).toEqual([SPEND]);
  });
  it("returns an empty list for a constant", () => {
    expect(collectPropertyRefs({ kind: "const", value: "100" })).toEqual([]);
  });
});

describe("assertFormulaIsValid", () => {
  it("accepts a formula over entered properties", () => {
    expect(() => assertFormulaIsValid(NEW, div(col(SPEND), col(CLICKS)), properties)).not.toThrow();
  });
  it("accepts a reference to a computed property", () => {
    expect(() => assertFormulaIsValid(NEW, div(col(CPC), col(CLICKS)), properties)).not.toThrow();
  });
  it("rejects a reference to a property outside the campaign", () => {
    expect(() => assertFormulaIsValid(NEW, col("99999999-9999-9999-9999-999999999999"), properties))
      .toThrow(ValidationError);
  });
  it("rejects a self-reference", () => {
    expect(() => assertFormulaIsValid(CPC, div(col(CPC), col(CLICKS)), properties))
      .toThrow(ValidationError);
  });
  it("rejects a reference to a text property", () => {
    expect(() => assertFormulaIsValid(NEW, div(col(COMMENT), col(CLICKS)), properties))
      .toThrow(ValidationError);
  });
  it("rejects a cycle through another property", () => {
    // SPEND would be redefined as SPEND = CPC / 2, while CPC = SPEND / CLICKS.
    expect(() => assertFormulaIsValid(SPEND, div(col(CPC), { kind: "const", value: "2" }), properties))
      .toThrow(ValidationError);
  });
});

describe("findDependents", () => {
  it("finds the properties whose formula uses a property", () => {
    expect(findDependents(SPEND, properties).map((c) => c.id)).toEqual([CPC]);
  });
  it("returns an empty list when nothing depends on the property", () => {
    expect(findDependents(COMMENT, properties)).toEqual([]);
  });
});
