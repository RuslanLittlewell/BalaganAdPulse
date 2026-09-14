import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs } from "../helpers/auth.js";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function seedAd(projectId: string) {
  const campaign = await seedCampaign(projectId, "Весна", "META");
  const adSet = await prisma.adSet.create({ data: { campaignId: campaign.id, name: "Москва", position: 0 } });
  const ad = await prisma.ad.create({ data: { adSetId: adSet.id, name: "Видео 1", externalId: "555", position: 0 } });
  return { campaign, adSet, ad };
}

const source = {
  accountId: "123", formId: "f1",
  campaignExternalId: "c1", campaignName: "Весна",
  adSetExternalId: "s1", adSetName: "Москва",
  adExternalId: "555", adName: "Видео 1",
  submittedAt: new Date("2026-09-10T10:00:00Z"),
  answers: [{ question: "full_name", values: ["Анна"] }],
};

describe("lead origin and Meta source persistence", () => {
  it("records a lead created without an origin as made by hand", async () => {
    await signInAs();
    const lead = await prisma.lead.create({ data: { name: "Hand-made", orgId: (await currentOrg()).id } });

    expect(lead.origin).toBe("MANUAL");
    expect(lead.adId).toBeNull();
  });

  it("releases the ad link when the ad is deleted and leaves the lead standing", async () => {
    const member = await signInAs();
    const { clientId, projectId } = await seedProject(member.user.id);
    const { campaign, ad } = await seedAd(projectId);
    const lead = await prisma.lead.create({
      data: { name: "Анна", orgId: (await currentOrg()).id, clientId, projectId, campaignId: campaign.id, adId: ad.id, origin: "META" },
    });

    await prisma.ad.delete({ where: { id: ad.id } });

    const after = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after).toMatchObject({ adId: null, campaignId: campaign.id, origin: "META" });
  });

  it("deletes the Meta source together with its lead", async () => {
    const member = await signInAs();
    const { clientId } = await seedProject(member.user.id);
    const lead = await prisma.lead.create({
      data: { name: "Анна", orgId: (await currentOrg()).id, clientId, origin: "META", metaSource: { create: source } },
    });
    expect(await prisma.leadMetaSource.findUnique({ where: { leadId: lead.id } })).toMatchObject({ formId: "f1", answersOmitted: false });

    await prisma.lead.delete({ where: { id: lead.id } });

    expect(await prisma.leadMetaSource.count()).toBe(0);
  });

  it("keeps the Meta lead key after its lead is deleted", async () => {
    const member = await signInAs();
    const { clientId } = await seedProject(member.user.id);
    const orgId = (await currentOrg()).id;
    const lead = await prisma.lead.create({ data: { name: "Анна", orgId, clientId, origin: "META" } });
    await prisma.metaLead.create({ data: { orgId, externalId: "L1", leadId: lead.id } });

    await prisma.lead.delete({ where: { id: lead.id } });

    expect(await prisma.metaLead.findUnique({ where: { orgId_externalId: { orgId, externalId: "L1" } } }))
      .toMatchObject({ leadId: null });
  });

  it("refuses a second key for the same Meta lead in one organization", async () => {
    await signInAs();
    const orgId = (await currentOrg()).id;
    await prisma.metaLead.create({ data: { orgId, externalId: "L1" } });

    await expect(prisma.metaLead.create({ data: { orgId, externalId: "L1" } })).rejects.toThrow();
  });
});

it("applies the lead origin migration to populated leads without changing them", async () => {
  const schema = `migration_${randomUUID().replaceAll("-", "")}`;
  const sql = readFileSync(new URL("../../prisma/migrations/20260913120000_meta_lead_import/migration.sql", import.meta.url), "utf8");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe("CREATE TABLE organization (id TEXT PRIMARY KEY)");
    await tx.$executeRawUnsafe("CREATE TABLE ad (id TEXT PRIMARY KEY)");
    await tx.$executeRawUnsafe("CREATE TABLE lead (id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organization(id), name TEXT NOT NULL)");
    await tx.$executeRaw`INSERT INTO organization VALUES ('org')`;
    await tx.$executeRaw`INSERT INTO lead VALUES ('old-lead', 'org', 'Existing lead')`;
    for (const statement of sql.split(";").filter((part) => part.trim())) await tx.$executeRawUnsafe(statement);
    expect(await tx.$queryRaw`SELECT id, org_id, name, origin::text AS origin, ad_id FROM lead`)
      .toEqual([{ id: "old-lead", org_id: "org", name: "Existing lead", origin: "MANUAL", ad_id: null }]);
    expect(await tx.$queryRaw`SELECT * FROM lead_meta_source`).toEqual([]);
    expect(await tx.$queryRaw`SELECT * FROM meta_lead`).toEqual([]);
    await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });
});
