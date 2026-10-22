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
    expect(await prisma.projectKpi.count({ where: { projectId } })).toBe(0);
    expect(await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).toMatchObject({ kpiMetric: null, kpiTarget: null });
  });

  it("refuses a metric without a target on an organization or a campaign", async () => {
    const member = await signInAs();
    const { projectId } = await seedProject(member.user.id);
    const campaign = await seedCampaign(projectId);
    const where = { id: campaign.id };

    await expect(prisma.campaign.update({ where, data: { kpiMetric: "CONVERSIONS" } })).rejects.toThrow();
    await expect(prisma.campaign.update({ where, data: { kpiTarget: "50" } })).rejects.toThrow();
    await expect(prisma.campaign.update({ where, data: { kpiMetric: "CONVERSIONS", kpiTarget: "50", kpiUpdatedAt: new Date() } })).resolves.toMatchObject({ kpiMetric: "CONVERSIONS" });
  });

  it("keeps a project KPI's name and value with a KPI set by hand and nowhere else", async () => {
    const member = await signInAs();
    const { projectId } = await seedProject(member.user.id);
    const base = { projectId, position: 0, target: "50", updatedAt: new Date() };

    await expect(prisma.projectKpi.create({ data: { ...base, metric: "MANUAL" } })).rejects.toThrow();
    await expect(prisma.projectKpi.create({ data: { ...base, metric: "MANUAL", name: "Продажи" } })).rejects.toThrow();
    await expect(prisma.projectKpi.create({ data: { ...base, metric: "CONVERSIONS", name: "Продажи", value: "1" } })).rejects.toThrow();
    await expect(prisma.projectKpi.create({ data: { ...base, metric: "MANUAL", name: "Продажи", value: "30" } }))
      .resolves.toMatchObject({ metric: "MANUAL", name: "Продажи", enabled: true });
  });

  it("refuses a KPI set by hand on a campaign or the organization", async () => {
    const member = await signInAs();
    const { projectId } = await seedProject(member.user.id);
    const campaign = await seedCampaign(projectId);
    const manual = { kpiMetric: "MANUAL", kpiTarget: "50", kpiUpdatedAt: new Date() } as const;

    await expect(prisma.campaign.update({ where: { id: campaign.id }, data: manual })).rejects.toThrow();
    await expect(prisma.organization.update({ where: { id: (await currentOrg()).id }, data: manual })).rejects.toThrow();
  });

  it("removes a KPI with its campaign or project and leaves the organization KPI alone", async () => {
    const member = await signInAs();
    const orgId = (await currentOrg()).id;
    const { projectId } = await seedProject(member.user.id);
    const campaign = await seedCampaign(projectId);
    await prisma.organization.update({ where: { id: orgId }, data: { kpiMetric: "SPEND", kpiTarget: "1000", kpiUpdatedAt: new Date() } });
    await prisma.campaign.update({ where: { id: campaign.id }, data: { kpiMetric: "CPA", kpiTarget: "20", kpiUpdatedAt: new Date() } });

    await prisma.projectKpi.create({ data: { projectId, position: 0, metric: "CONVERSIONS", target: "50", updatedAt: new Date() } });

    await prisma.project.delete({ where: { id: projectId } });

    expect(await prisma.campaign.count()).toBe(0);
    expect(await prisma.projectKpi.count()).toBe(0);
    expect(await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })).toMatchObject({ kpiMetric: "SPEND" });
  });

  it("keeps a campaign KPI through a Meta import", async () => {
    const member = await signInAs();
    const { projectId } = await seedProject(member.user.id);
    const now = new Date("2026-09-14T06:00:00Z");
    const campaign = await prisma.campaign.create({ data: { projectId, name: "Old", channel: "META", externalId: "101", position: 0, kpiMetric: "CPA", kpiTarget: "20", kpiUpdatedAt: now } });
    await prisma.projectIntegration.create({ data: { projectId, accountId: "123", currency: "BYN", timezone: "UTC", encryptedToken: "e", revision: "v1", nextDailyAt: now, queuedAt: now } });
    await prisma.project.update({ where: { id: projectId }, data: { budgetCurrency: "BYN" } });
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

it("moves each project's KPI into the project KPI table and drops the old columns", async () => {
  const schema = `migration_${randomUUID().replaceAll("-", "")}`;
  const sql = readFileSync(new URL("../../prisma/migrations/20261022120000_project_kpis/migration.sql", import.meta.url), "utf8");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe("CREATE TYPE kpi_metric AS ENUM ('CONVERSIONS', 'MANUAL')");
    await tx.$executeRawUnsafe(`CREATE TABLE project (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, kpi_metric kpi_metric, kpi_target DECIMAL(18,4),
      kpi_name TEXT, kpi_value DECIMAL(18,4), kpi_updated_at TIMESTAMP(3))`);
    await tx.$executeRaw`INSERT INTO project (id, name, kpi_metric, kpi_target, kpi_updated_at)
      VALUES ('measured', 'Clinic', 'CONVERSIONS', 50, '2026-10-01T10:00:00Z')`;
    await tx.$executeRaw`INSERT INTO project (id, name, kpi_metric, kpi_target, kpi_name, kpi_value, kpi_updated_at)
      VALUES ('manual', 'Studio', 'MANUAL', 40, 'Продажи', 12, '2026-10-02T10:00:00Z')`;
    await tx.$executeRaw`INSERT INTO project (id, name) VALUES ('bare', 'Garage')`;

    for (const statement of sql.split(";").filter((part) => part.trim())) await tx.$executeRawUnsafe(statement);

    const kpis = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      "SELECT project_id, position, metric::text, target::text, name, value::text, enabled FROM project_kpi ORDER BY project_id");
    expect(kpis).toEqual([
      { project_id: "manual", position: 0, metric: "MANUAL", target: "40.0000", name: "Продажи", value: "12.0000", enabled: true },
      { project_id: "measured", position: 0, metric: "CONVERSIONS", target: "50.0000", name: null, value: null, enabled: true },
    ]);
    const columns = await tx.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = '${schema}' AND table_name = 'project' ORDER BY column_name`);
    expect(columns.map((column) => column.column_name)).toEqual(["id", "name"]);
    await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });
});
