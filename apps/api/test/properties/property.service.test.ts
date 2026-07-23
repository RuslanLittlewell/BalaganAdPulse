import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import { ConflictError, NotFoundError, ValidationError } from "../../src/errors.js";
import { createCampaign } from "../../src/campaigns/campaign.service.js";
import { createProperty, updateProperty, deleteProperty } from "../../src/properties/property.service.js";
import type { Expression } from "../../src/formula/expression.schema.js";

const MISSING = "00000000-0000-0000-0000-000000000000";

let campaignId: string;
let propertyIdByKey: Map<string | null, string>;

beforeEach(async () => {
  await resetDb();
  const client = await prisma.client.create({ data: { name: "Acme" } });
  const campaign = await createCampaign(client.id, { name: "A" });
  campaignId = campaign.id;
  const properties = await prisma.campaignProperty.findMany({ where: { campaignId } });
  propertyIdByKey = new Map(properties.map((property) => [property.key, property.id]));
});
afterAll(async () => { await prisma.$disconnect(); });

const col = (propertyId: string): Expression => ({ kind: "property", propertyId });

describe("property.service", () => {
  it("appends a custom property at the end with a null key", async () => {
    const property = await createProperty(campaignId, { name: "FREQUENCY", type: "NUMBER" });
    expect(property.position).toBe(11);
    expect(property.key).toBeNull();
  });

  it("inserts at a position and shifts the following properties", async () => {
    const property = await createProperty(campaignId, { name: "NOTE", type: "TEXT", position: 0 });
    const properties = await prisma.campaignProperty.findMany({
      where: { campaignId }, orderBy: { position: "asc" },
    });
    expect(properties[0].id).toBe(property.id);
    expect(properties.map((c) => c.position)).toEqual([0,1,2,3,4,5,6,7,8,9,10,11]);
  });

  it("creates a property with a formula", async () => {
    const property = await createProperty(campaignId, {
      name: "DOUBLE SPEND", type: "MONEY",
      formula: { kind: "binary", op: "*", left: col(propertyIdByKey.get("spend")!), right: { kind: "const", value: "2" } },
    });
    expect(property.formula).toBeTruthy();
  });

  it("rejects a formula referencing a text property", async () => {
    await expect(createProperty(campaignId, {
      name: "BAD", type: "NUMBER",
      formula: col(propertyIdByKey.get("comment")!),
    })).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a formula on a text property", async () => {
    await expect(createProperty(campaignId, {
      name: "BAD", type: "TEXT", formula: col(propertyIdByKey.get("spend")!),
    })).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a cyclic formula on update", async () => {
    // SPEND = CPC * CLICKS would close the cycle, since CPC = SPEND / CLICKS.
    await expect(updateProperty(propertyIdByKey.get("spend")!, {
      formula: { kind: "binary", op: "*", left: col(propertyIdByKey.get("cpc")!), right: col(propertyIdByKey.get("clicks")!) },
    })).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses to attach a formula to a property that already has values", async () => {
    const record = await prisma.campaignRecord.create({
      data: { campaignId, date: new Date("2026-07-21T00:00:00.000Z") },
    });
    await prisma.campaignPropertyValue.create({
      data: { recordId: record.id, propertyId: propertyIdByKey.get("clicks")!, numberValue: "10" },
    });
    await expect(updateProperty(propertyIdByKey.get("clicks")!, {
      formula: { kind: "const", value: "1" },
    })).rejects.toBeInstanceOf(ConflictError);
  });

  it("clears a formula, turning the property into an entered one", async () => {
    const updated = await updateProperty(propertyIdByKey.get("ctr")!, { formula: null });
    expect(updated.formula).toBeNull();
  });

  it("renames and retypes between numeric types", async () => {
    const updated = await updateProperty(propertyIdByKey.get("clicks")!, {
      name: "TOTAL CLICKS", type: "MONEY",
    });
    expect(updated.name).toBe("TOTAL CLICKS");
    expect(updated.type).toBe("MONEY");
  });

  it("refuses to retype a computed property to TEXT while it still has a formula", async () => {
    const property = await createProperty(campaignId, {
      name: "DOUBLE SPEND", type: "MONEY",
      formula: { kind: "binary", op: "*", left: col(propertyIdByKey.get("spend")!), right: { kind: "const", value: "2" } },
    });
    await expect(updateProperty(property.id, { type: "TEXT" })).rejects.toBeInstanceOf(ValidationError);

    const unchanged = await prisma.campaignProperty.findUnique({ where: { id: property.id } });
    expect(unchanged?.type).toBe("MONEY");
    expect(unchanged?.formula).toBeTruthy();
  });

  it("allows retyping a computed property to TEXT when the formula is cleared in the same request", async () => {
    const property = await createProperty(campaignId, {
      name: "DOUBLE SPEND", type: "MONEY",
      formula: { kind: "binary", op: "*", left: col(propertyIdByKey.get("spend")!), right: { kind: "const", value: "2" } },
    });
    const updated = await updateProperty(property.id, { type: "TEXT", formula: null });
    expect(updated.type).toBe("TEXT");
    expect(updated.formula).toBeNull();
  });

  it("refuses to switch between text and numeric while values exist", async () => {
    const record = await prisma.campaignRecord.create({
      data: { campaignId, date: new Date("2026-07-21T00:00:00.000Z") },
    });
    await prisma.campaignPropertyValue.create({
      data: { recordId: record.id, propertyId: propertyIdByKey.get("comment")!, textValue: "note" },
    });
    await expect(updateProperty(propertyIdByKey.get("comment")!, { type: "NUMBER" }))
      .rejects.toBeInstanceOf(ConflictError);
  });

  it("moves a property and renumbers the rest", async () => {
    await updateProperty(propertyIdByKey.get("comment")!, { position: 0 });
    const properties = await prisma.campaignProperty.findMany({
      where: { campaignId }, orderBy: { position: "asc" },
    });
    expect(properties[0].key).toBe("comment");
    expect(properties.map((c) => c.position)).toEqual([0,1,2,3,4,5,6,7,8,9,10]);
  });

  it("refuses to delete a property used by a formula", async () => {
    await expect(deleteProperty(propertyIdByKey.get("spend")!)).rejects.toBeInstanceOf(ConflictError);
  });

  it("deletes an unused property and renumbers the rest", async () => {
    await deleteProperty(propertyIdByKey.get("comment")!);
    const properties = await prisma.campaignProperty.findMany({
      where: { campaignId }, orderBy: { position: "asc" },
    });
    expect(properties).toHaveLength(10);
    expect(properties.map((c) => c.position)).toEqual([0,1,2,3,4,5,6,7,8,9]);
  });

  it("throws NotFoundError for a missing campaign or property", async () => {
    await expect(createProperty(MISSING, { name: "X", type: "NUMBER" }))
      .rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteProperty(MISSING)).rejects.toBeInstanceOf(NotFoundError);
  });
});
