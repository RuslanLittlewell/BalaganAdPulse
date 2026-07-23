import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

async function seedCampaign() {
  const client = await prisma.client.create({ data: { name: "Acme" } });
  const campaign = await prisma.campaign.create({
    data: { clientId: client.id, name: "Facebook — July", position: 0 },
  });
  return { client, campaign };
}

describe("campaign schema", () => {
  it("stores a property value as Decimal without precision loss", async () => {
    const { campaign } = await seedCampaign();
    const property = await prisma.campaignProperty.create({
      data: { campaignId: campaign.id, key: "spend", name: "SPEND", type: "MONEY", position: 0 },
    });
    const record = await prisma.campaignRecord.create({
      data: { campaignId: campaign.id, date: new Date("2026-07-21T00:00:00.000Z") },
    });
    const stored = await prisma.campaignPropertyValue.create({
      data: { recordId: record.id, propertyId: property.id, numberValue: "1234.5678" },
    });
    expect(String(stored.numberValue)).toBe("1234.5678");
  });

  it("stores a formula as JSON on a property", async () => {
    const { campaign } = await seedCampaign();
    const property = await prisma.campaignProperty.create({
      data: {
        campaignId: campaign.id, key: "ctr", name: "CTR", type: "PERCENT", position: 1,
        formula: { kind: "const", value: "100" },
      },
    });
    const stored = await prisma.campaignProperty.findUniqueOrThrow({ where: { id: property.id } });
    expect(stored.formula).toEqual({ kind: "const", value: "100" });
  });

  it("rejects two records with the same date in one campaign", async () => {
    const { campaign } = await seedCampaign();
    const date = new Date("2026-07-21T00:00:00.000Z");
    await prisma.campaignRecord.create({ data: { campaignId: campaign.id, date } });
    await expect(
      prisma.campaignRecord.create({ data: { campaignId: campaign.id, date } }),
    ).rejects.toThrow();
  });

  it("cascades deletion from the client down to property values", async () => {
    const { client, campaign } = await seedCampaign();
    const property = await prisma.campaignProperty.create({
      data: { campaignId: campaign.id, key: "spend", name: "SPEND", type: "MONEY", position: 0 },
    });
    const record = await prisma.campaignRecord.create({
      data: { campaignId: campaign.id, date: new Date("2026-07-21T00:00:00.000Z") },
    });
    await prisma.campaignPropertyValue.create({
      data: { recordId: record.id, propertyId: property.id, numberValue: "10" },
    });

    await prisma.client.delete({ where: { id: client.id } });

    expect(await prisma.campaign.count()).toBe(0);
    expect(await prisma.campaignProperty.count()).toBe(0);
    expect(await prisma.campaignRecord.count()).toBe(0);
    expect(await prisma.campaignPropertyValue.count()).toBe(0);
  });
});
