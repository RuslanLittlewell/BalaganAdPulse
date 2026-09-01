import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  PrismaAuditContext,
  PrismaCampaignRepository,
  PrismaProjectReach,
  PrismaPropertyRepository,
} from "../../src/modules/campaigns/infrastructure/prisma-campaign-repositories.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { RandomIdGenerator } from "../../src/shared/infrastructure/id-generator.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs } from "../helpers/auth.js";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

function adapters() {
  const unitOfWork = new PrismaUnitOfWork<Prisma.TransactionClient>(prisma);
  return {
    unitOfWork,
    campaigns: new PrismaCampaignRepository(prisma, unitOfWork, new RandomIdGenerator()),
    properties: new PrismaPropertyRepository(prisma, unitOfWork),
    projects: new PrismaProjectReach(prisma),
    auditContext: new PrismaAuditContext(prisma),
  };
}

const uuid = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-a${String(n).repeat(3)}-${String(n).repeat(12)}`;

describe("Prisma campaign repository", () => {
  it("seeds the eleven default columns, with the computed ones referencing the entered ones", async () => {
    const { unitOfWork, campaigns } = adapters();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { projectId } = await seedProject(admin.user.id, "Acme");

    const created = await unitOfWork.run((context) =>
      campaigns.create(context, { id: uuid(1), projectId, name: "Fresh", position: 1 }),
    );

    const stored = await prisma.campaignProperty.findMany({
      where: { campaignId: created.id }, orderBy: { position: "asc" },
    });
    expect(stored.map((property) => property.key)).toEqual([
      "spend", "impressions", "clicks", "ctr", "cpm", "cpc",
      "leads", "cpl", "revenue", "roas", "comment",
    ]);
    const byKey = new Map(stored.map((property) => [property.key, property]));
    const cpc = JSON.stringify(byKey.get("cpc")!.formula);
    expect(cpc).toContain(byKey.get("spend")!.id);
    expect(cpc).toContain(byKey.get("clicks")!.id);
  });

  it("reads back a table with its stored values as decimals", async () => {
    const { campaigns } = adapters();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { projectId } = await seedProject(admin.user.id, "Acme");
    const campaign = await seedCampaign(projectId, "Main");
    const spend = await prisma.campaignProperty.findFirstOrThrow({
      where: { campaignId: campaign.id, key: "spend" },
    });
    const record = await prisma.campaignRecord.create({
      data: { campaignId: campaign.id, date: new Date("2026-09-01T00:00:00.000Z") },
    });
    await prisma.campaignPropertyValue.create({
      data: { recordId: record.id, propertyId: spend.id, numberValue: "150.5" },
    });

    const data = await campaigns.readTable(admin.actor!, campaign.id);
    expect(data!.records[0].date).toBe("2026-09-01");
    expect(data!.records[0].storedValues[0].numberValue?.toString()).toBe("150.5");
  });

  it("renumbers a project's campaigns densely, moving one into place", async () => {
    const { unitOfWork, campaigns } = adapters();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { projectId } = await seedProject(admin.user.id, "Acme");
    const first = await seedCampaign(projectId, "A");
    const second = await seedCampaign(projectId, "B");
    const third = await seedCampaign(projectId, "C");

    await unitOfWork.run((context) => campaigns.renumber(context, projectId, third.id, 0));

    const ordered = await prisma.campaign.findMany({ where: { projectId }, orderBy: { position: "asc" } });
    expect(ordered.map((campaign) => campaign.id)).toEqual([third.id, first.id, second.id]);
    expect(ordered.map((campaign) => campaign.position)).toEqual([0, 1, 2]);
  });

  it("closes the gap after a delete", async () => {
    const { unitOfWork, campaigns } = adapters();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { projectId } = await seedProject(admin.user.id, "Acme");
    const first = await seedCampaign(projectId, "A");
    const second = await seedCampaign(projectId, "B");

    await unitOfWork.run(async (context) => {
      await campaigns.delete(context, first.id);
      await campaigns.renumber(context, projectId);
    });
    const remaining = await prisma.campaign.findMany({ where: { projectId } });
    expect(remaining.map((campaign) => campaign.id)).toEqual([second.id]);
    expect(remaining[0].position).toBe(0);
  });

  it("hides a campaign the actor holds no grant for", async () => {
    const { campaigns } = adapters();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { clientId, projectId } = await seedProject(admin.user.id, "Acme");
    const campaign = await seedCampaign(projectId, "Main");
    const manager = await signInAs("Manager", { role: "MANAGER" });

    expect(await campaigns.findReachable(manager.actor!, campaign.id)).toBeNull();
    await grantAccess(manager.membership!.id, clientId);
    expect(await campaigns.findReachable(manager.actor!, campaign.id)).not.toBeNull();
  });

  it("rolls a campaign back when the surrounding transaction fails", async () => {
    const { unitOfWork, campaigns } = adapters();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { projectId } = await seedProject(admin.user.id, "Acme");
    const before = await prisma.campaign.count();

    await expect(unitOfWork.run(async (context) => {
      await campaigns.create(context, { id: uuid(2), projectId, name: "Doomed", position: 9 });
      throw new Error("the rest of the operation failed");
    })).rejects.toThrow("the rest of the operation failed");

    expect(await prisma.campaign.count()).toBe(before);
    expect(await prisma.campaignProperty.count({ where: { campaign: { name: "Doomed" } } })).toBe(0);
  });
});

describe("Prisma property repository", () => {
  it("shifts the columns at and after a position to make room", async () => {
    const { unitOfWork, properties } = adapters();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { projectId } = await seedProject(admin.user.id, "Acme");
    const campaign = await seedCampaign(projectId, "Main");

    await unitOfWork.run((context) => properties.shiftFrom(context, campaign.id, 2));
    const ordered = await properties.siblings(campaign.id);
    expect(ordered.map((property) => property.position)).toEqual([0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("round-trips a formula through the JSON column", async () => {
    const { unitOfWork, properties } = adapters();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { projectId } = await seedProject(admin.user.id, "Acme");
    const campaign = await seedCampaign(projectId, "Main");
    const spend = (await properties.siblings(campaign.id)).find((p) => p.key === "spend")!;
    const formula = { kind: "binary" as const, op: "*" as const,
      left: { kind: "property" as const, propertyId: spend.id },
      right: { kind: "const" as const, value: "2" } };

    const created = await unitOfWork.run((context) => properties.create(context, {
      id: uuid(3), campaignId: campaign.id, key: null, name: "DOUBLE",
      type: "MONEY", position: 11, formula,
    }));
    expect(created.formula).toEqual(formula);
    expect((await properties.findReachable(admin.actor!, created.id))!.formula).toEqual(formula);
  });

  it("clears a formula back to null", async () => {
    const { unitOfWork, properties } = adapters();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { projectId } = await seedProject(admin.user.id, "Acme");
    const campaign = await seedCampaign(projectId, "Main");
    const cpc = (await properties.siblings(campaign.id)).find((p) => p.key === "cpc")!;

    await unitOfWork.run((context) => properties.update(context, cpc.id, { formula: null }));
    expect((await properties.findReachable(admin.actor!, cpc.id))!.formula).toBeNull();
  });

  it("counts the values entered against a column", async () => {
    const { properties } = adapters();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { projectId } = await seedProject(admin.user.id, "Acme");
    const campaign = await seedCampaign(projectId, "Main");
    const spend = (await properties.siblings(campaign.id)).find((p) => p.key === "spend")!;
    const record = await prisma.campaignRecord.create({
      data: { campaignId: campaign.id, date: new Date("2026-09-01T00:00:00.000Z") },
    });

    expect(await properties.countValues(spend.id)).toBe(0);
    await prisma.campaignPropertyValue.create({
      data: { recordId: record.id, propertyId: spend.id, numberValue: "1" },
    });
    expect(await properties.countValues(spend.id)).toBe(1);
  });

  it("hides a column of a campaign the actor cannot reach", async () => {
    const { properties } = adapters();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { projectId } = await seedProject(admin.user.id, "Acme");
    const campaign = await seedCampaign(projectId, "Main");
    const spend = (await properties.siblings(campaign.id)).find((p) => p.key === "spend")!;
    const manager = await signInAs("Manager", { role: "MANAGER" });

    expect(await properties.findReachable(manager.actor!, spend.id)).toBeNull();
  });
});

describe("Prisma project reach and audit context", () => {
  it("answers the client a reachable project belongs to, and nothing for one out of reach", async () => {
    const { projects } = adapters();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { clientId, projectId } = await seedProject(admin.user.id, "Acme");
    const manager = await signInAs("Manager", { role: "MANAGER" });

    expect(await projects.contextFor(admin.actor!, projectId)).toEqual({ clientId });
    expect(await projects.contextFor(manager.actor!, projectId)).toBeNull();
  });

  it("resolves the client, project and campaign an audit event belongs to", async () => {
    const { auditContext } = adapters();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { clientId, projectId } = await seedProject(admin.user.id, "Acme");
    const campaign = await seedCampaign(projectId, "Main");

    expect(await auditContext.forCampaign(campaign.id))
      .toEqual({ clientId, projectId, campaignId: campaign.id });
  });
});
