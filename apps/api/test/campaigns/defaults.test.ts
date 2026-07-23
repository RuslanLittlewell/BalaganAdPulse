import { describe, it, expect } from "vitest";
import { buildDefaultProperties } from "../../src/campaigns/defaults.js";
import { collectPropertyRefs } from "../../src/formula/dependencies.js";
import { expressionSchema } from "../../src/formula/expression.schema.js";

describe("buildDefaultProperties", () => {
  const properties = buildDefaultProperties();
  const byKey = new Map(properties.map((property) => [property.key, property]));

  it("returns the eleven default properties in order", () => {
    expect(properties.map((property) => property.key)).toEqual([
      "spend", "impressions", "clicks", "ctr", "cpm", "cpc",
      "leads", "cpl", "revenue", "roas", "comment",
    ]);
    expect(properties.map((property) => property.position)).toEqual([0,1,2,3,4,5,6,7,8,9,10]);
  });

  it("marks entered properties with a null formula", () => {
    for (const key of ["spend", "impressions", "clicks", "leads", "revenue", "comment"]) {
      expect(byKey.get(key)?.formula).toBeNull();
    }
  });

  it("wires CTR to clicks and impressions", () => {
    const ctr = byKey.get("ctr");
    expect(ctr?.type).toBe("PERCENT");
    expect(collectPropertyRefs(ctr!.formula!).sort()).toEqual(
      [byKey.get("clicks")!.id, byKey.get("impressions")!.id].sort(),
    );
  });

  it("wires ROAS to revenue and spend", () => {
    expect(collectPropertyRefs(byKey.get("roas")!.formula!).sort()).toEqual(
      [byKey.get("revenue")!.id, byKey.get("spend")!.id].sort(),
    );
  });

  it("produces formulas that satisfy the expression schema", () => {
    for (const property of properties) {
      if (property.formula) expect(() => expressionSchema.parse(property.formula)).not.toThrow();
    }
  });

  it("produces fresh ids on every call", () => {
    expect(buildDefaultProperties()[0].id).not.toBe(properties[0].id);
  });
});
