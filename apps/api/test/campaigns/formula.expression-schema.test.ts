import { describe, it, expect } from "vitest";
import { expressionSchema } from "../../src/modules/campaigns/presentation/http/campaign-schemas.js";

const CLICKS = "11111111-1111-1111-a111-111111111111";
const IMPRESSIONS = "22222222-2222-2222-a222-222222222222";

const ctr = {
  kind: "binary", op: "*",
  left: {
    kind: "binary", op: "/",
    left: { kind: "property", propertyId: CLICKS },
    right: { kind: "property", propertyId: IMPRESSIONS },
  },
  right: { kind: "const", value: "100" },
};

describe("expressionSchema", () => {
  it("parses a nested tree", () => {
    expect(expressionSchema.parse(ctr)).toEqual(ctr);
  });
  it("rejects an unknown operator", () => {
    expect(() => expressionSchema.parse({
      kind: "binary", op: "%",
      left: { kind: "const", value: "1" }, right: { kind: "const", value: "2" },
    })).toThrow();
  });
  it("rejects an unknown node kind", () => {
    expect(() => expressionSchema.parse({ kind: "lookup", propertyId: CLICKS })).toThrow();
  });
  it("rejects a non-decimal constant", () => {
    expect(() => expressionSchema.parse({ kind: "const", value: "ten" })).toThrow();
  });
  it("rejects a property reference that is not a uuid", () => {
    expect(() => expressionSchema.parse({ kind: "property", propertyId: "clicks" })).toThrow();
  });
  it("rejects a malformed nested branch", () => {
    expect(() => expressionSchema.parse({
      kind: "binary", op: "+",
      left: { kind: "const", value: "1" }, right: { kind: "const" },
    })).toThrow();
  });
});

