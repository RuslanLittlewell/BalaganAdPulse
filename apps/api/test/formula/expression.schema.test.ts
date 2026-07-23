import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { expressionSchema, toJson, fromJson } from "../../src/formula/expression.schema.js";

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

describe("json conversion", () => {
  it("maps null to Prisma.DbNull and back", () => {
    expect(toJson(null)).toBe(Prisma.DbNull);
    expect(fromJson(null)).toBeNull();
  });
  it("round-trips a tree", () => {
    const stored = toJson(expressionSchema.parse(ctr)) as Prisma.JsonValue;
    expect(fromJson(stored)).toEqual(ctr);
  });
});
