import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import { NotFoundError } from "../../src/errors.js";
import {
  createCampaign, listCampaigns, getCampaign, getCampaignTable,
  updateCampaign, deleteCampaign,
} from "../../src/campaigns/campaign.service.js";
import { signInAs } from "../helpers/auth.js";

const MISSING = "00000000-0000-0000-0000-000000000000";

let ownerId: string;
let clientId: string;

beforeEach(async () => {
  await resetDb();
  const { user } = await signInAs();
  ownerId = user.id;
  const client = await prisma.client.create({ data: { name: "Acme", ownerId: user.id } });
  clientId = client.id;
});
afterAll(async () => { await prisma.$disconnect(); });

describe("campaign.service", () => {
  it("creates a campaign with the default properties", async () => {
    const campaign = await createCampaign(ownerId, clientId, { name: "Facebook — July" });
    const properties = await prisma.campaignProperty.findMany({
      where: { campaignId: campaign.id }, orderBy: { position: "asc" },
    });
    expect(campaign.position).toBe(0);
    expect(properties).toHaveLength(11);
    expect(properties.map((property) => property.key)).toEqual([
      "spend", "impressions", "clicks", "ctr", "cpm", "cpc",
      "leads", "cpl", "revenue", "roas", "comment",
    ]);
    expect(properties[3].formula).toBeTruthy();
  });

  it("throws NotFoundError for a missing client", async () => {
    await expect(createCampaign(ownerId, MISSING, { name: "X" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("appends new campaigns at the end and lists them by position", async () => {
    await createCampaign(ownerId, clientId, { name: "A" });
    await createCampaign(ownerId, clientId, { name: "B" });
    expect((await listCampaigns(ownerId, clientId)).map((c) => c.name)).toEqual(["A", "B"]);
  });

  it("moves a campaign and renumbers its siblings", async () => {
    const a = await createCampaign(ownerId, clientId, { name: "A" });
    await createCampaign(ownerId, clientId, { name: "B" });
    await createCampaign(ownerId, clientId, { name: "C" });
    await updateCampaign(ownerId, a.id, { position: 2 });
    const listed = await listCampaigns(ownerId, clientId);
    expect(listed.map((c) => c.name)).toEqual(["B", "C", "A"]);
    expect(listed.map((c) => c.position)).toEqual([0, 1, 2]);
  });

  it("renumbers the remaining campaigns after a delete", async () => {
    const a = await createCampaign(ownerId, clientId, { name: "A" });
    await createCampaign(ownerId, clientId, { name: "B" });
    await deleteCampaign(ownerId, a.id);
    expect((await listCampaigns(ownerId, clientId)).map((c) => c.position)).toEqual([0]);
  });

  it("getCampaign throws NotFoundError", async () => {
    await expect(getCampaign(ownerId, MISSING)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("hides another owner's campaign behind the same NotFoundError", async () => {
    const campaign = await createCampaign(ownerId, clientId, { name: "A" });
    const { user: other } = await signInAs("Other");
    await expect(getCampaign(other.id, campaign.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("renames a campaign", async () => {
    const campaign = await createCampaign(ownerId, clientId, { name: "A" });
    expect((await updateCampaign(ownerId, campaign.id, { name: "B" })).name).toBe("B");
  });

  it("returns a table payload with properties, records and totals", async () => {
    const campaign = await createCampaign(ownerId, clientId, { name: "A" });
    const properties = await prisma.campaignProperty.findMany({ where: { campaignId: campaign.id } });
    const byKey = new Map(properties.map((property) => [property.key, property]));
    const record = await prisma.campaignRecord.create({
      data: { campaignId: campaign.id, date: new Date("2026-07-21T00:00:00.000Z") },
    });
    await prisma.campaignPropertyValue.createMany({
      data: [
        { recordId: record.id, propertyId: byKey.get("clicks")!.id, numberValue: "25" },
        { recordId: record.id, propertyId: byKey.get("impressions")!.id, numberValue: "1000" },
      ],
    });

    const payload = await getCampaignTable(ownerId, campaign.id);
    expect(payload.properties).toHaveLength(11);
    expect(payload.records[0].date).toBe("2026-07-21");
    expect(payload.records[0].values[byKey.get("ctr")!.id]).toBe("2.5000");
    expect(payload.totals[byKey.get("clicks")!.id]).toBe("25.0000");
  });

  it("getCampaignTable throws NotFoundError", async () => {
    await expect(getCampaignTable(ownerId, MISSING)).rejects.toBeInstanceOf(NotFoundError);
  });
});
