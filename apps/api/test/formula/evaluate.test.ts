import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { evaluate } from "../../src/formula/evaluate.js";
import type { Expression } from "../../src/formula/expression.schema.js";

const CLICKS = "11111111-1111-1111-1111-111111111111";
const IMPRESSIONS = "22222222-2222-2222-2222-222222222222";

const ctr: Expression = {
  kind: "binary", op: "*",
  left: {
    kind: "binary", op: "/",
    left: { kind: "property", propertyId: CLICKS },
    right: { kind: "property", propertyId: IMPRESSIONS },
  },
  right: { kind: "const", value: "100" },
};

function resolver(values: Record<string, string | null>) {
  return (propertyId: string) => {
    const value = values[propertyId];
    return value === undefined || value === null ? null : new Prisma.Decimal(value);
  };
}

describe("evaluate", () => {
  it("computes a nested expression", () => {
    const result = evaluate(ctr, resolver({ [CLICKS]: "25", [IMPRESSIONS]: "1000" }));
    expect(result?.toFixed(4)).toBe("2.5000");
  });
  it("returns null when an operand is null", () => {
    expect(evaluate(ctr, resolver({ [CLICKS]: "25", [IMPRESSIONS]: null }))).toBeNull();
  });
  it("returns null when a referenced property is unknown", () => {
    expect(evaluate(ctr, resolver({}))).toBeNull();
  });
  it("returns null on division by zero", () => {
    expect(evaluate(ctr, resolver({ [CLICKS]: "25", [IMPRESSIONS]: "0" }))).toBeNull();
  });
  it("keeps decimal precision on addition", () => {
    const sum: Expression = {
      kind: "binary", op: "+",
      left: { kind: "const", value: "0.1" }, right: { kind: "const", value: "0.2" },
    };
    expect(evaluate(sum, resolver({}))?.toFixed(4)).toBe("0.3000");
  });
  it("supports subtraction", () => {
    const diff: Expression = {
      kind: "binary", op: "-",
      left: { kind: "property", propertyId: CLICKS }, right: { kind: "const", value: "5" },
    };
    expect(evaluate(diff, resolver({ [CLICKS]: "25" }))?.toFixed(4)).toBe("20.0000");
  });
});
