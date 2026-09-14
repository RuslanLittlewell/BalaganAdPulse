import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaImportJobs } from "../../src/modules/integrations/infrastructure/prisma-import-jobs.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs } from "../helpers/auth.js";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("KPI storage", () => {
  it("leaves organizations, projects and campaigns without a KPI until one is set", async () => {
    const member = await signInAs();
    const { projectId } = await seedProject(member.user.id);
    const campaign = await seedCampaign(projectId);

    expect(await prisma.organization.findUniqueOrThrow({ where: { id: (await currentOrg()).id } })).toMatchObject({ kpiMetric: null, kpiTarget: null, kpiUpdatedAt: null });
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ kpiMetric: null, kpiTarget: null });
    expect(await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).toMatchObject({ kpiMetric: null, kpiTarget: null });
  });

  it("refuses a metric without a target and a target without a metric", async () => {
    const member = await signInAs();
    const { projectId } = await seedProject(member.user.id);

    await expect(prisma.project.update({ where: { id: projectId }, data: { kpiMetric: "CONVERSIONS" } })).rejects.toThrow();
    await expect(prisma.project.update({ where: { id: projectId }, data: { kpiTarget: "50" } })).rejects.toThrow();
    await expect(prisma.project.update({ where: { id: projectId }, data: { kpiMetric: "CONVERSIONS", kpiTarget: "50", kpiUpdatedAt: new Date() } })).resolves.toMatchObject({ kpiMetric: "CONVERSIONS" });
  });

  it("removes a KPI with its campaign or project and leaves the organization KPI alone", async () => {
    const member = await signInAs();
    const orgId = (await currentOrg()).id;
    const { projectId } = await seedProject(member.user.id);
    const campaign = await seedCampaign(projectId);
    await prisma.organization.update({ where: { id: orgId }, data: { kpiMetric: "SPEND", kpiTarget: "1000", kpiUpdatedAt: new Date() } });
    await prisma.campaign.update({ where: { id: campaign.id }, data: { kpiMetric: "CPA", kpiTarget: "20", kpiUpdatedAt: new Date() } });

    await prisma.project.delete({ where: { id: projectId } });

    expect(await prisma.campaign.count()).toBe(0);
    expect(await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })).toMatchObject({ kpiMetric: "SPEND" });
  });

  it("keeps a campaign KPI through a Meta import", async () => {
    const member = await signInAs();
    const { projectId } = await seedProject(member.user.id);
    const now = new Date("2026-09-14T06:00:00Z");
    const campaign = await prisma.campaign.create({ data: { projectId, name: "Old", channel: "META", externalId: "101", position: 0, kpiMetric: "CPA", kpiTarget: "20", kpiUpdatedAt: now } });
    await prisma.projectIntegration.create({ data: { projectId, accountId: "123", currency: "BYN", timezone: "UTC", encryptedToken: "e", revision: "v1", nextDailyAt: now, queuedAt: now } });
    const jobs = new PrismaImportJobs(prisma);
    const job = (await jobs.claim(now))!;

    await jobs.complete(job, { from: "2026-08-14", to: "2026-09-13", campaigns: [{ id: "101", name: "Renamed", status: "ACTIVE" }], adSets: [], ads: [], campaignMetrics: [], adSetMetrics: [], adMetrics: [] }, now);

    expect(await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).toMatchObject({ name: "Renamed", kpiMetric: "CPA" });
  });
});

it("applies the KPI migration to populated tables without changing their rows", async () => {
  const schema = `migration_${randomUUID().replaceAll("-", "")}`;
  const sql = readFileSync(new URL("../../prisma/migrations/20260914120000_kpi_targets/migration.sql", import.meta.url), "utf8");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe("CREATE TABLE organization (id TEXT PRIMARY KEY, name TEXT NOT NULL)");
    await tx.$executeRawUnsafe("CREATE TABLE project (id TEXT PRIMARY KEY, name TEXT NOT NULL)");
    await tx.$executeRawUnsafe("CREATE TABLE campaign (id TEXT PRIMARY KEY, name TEXT NOT NULL)");
    await tx.$executeRaw`INSERT INTO organization VALUES ('org', 'Agency')`;
    await tx.$executeRaw`INSERT INTO project VALUES ('project', 'Clinic')`;
    await tx.$executeRaw`INSERT INTO campaign VALUES ('campaign', 'Search')`;
    for (const statement of sql.split(";").filter((part) => part.trim())) await tx.$executeRawUnsafe(statement);
    for (const table of ["organization", "project", "campaign"]) {
      const rows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT id, name, kpi_metric, kpi_target, kpi_updated_at FROM ${table}`);
      expect(rows).toEqual([expect.objectContaining({ kpi_metric: null, kpi_target: null, kpi_updated_at: null })]);
    }
    await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });
});
