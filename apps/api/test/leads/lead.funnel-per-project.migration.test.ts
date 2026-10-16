import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";

afterAll(() => prisma.$disconnect());

it("drops the agency funnel, unattributed leads and custom columns, and renumbers each project board", async () => {
  const schema = `migration_${randomUUID().replaceAll("-", "")}`;
  const sql = readFileSync(new URL("../../prisma/migrations/20260924120000_crm_funnel_per_project/migration.sql", import.meta.url), "utf8");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe(`CREATE TYPE "lead_stage" AS ENUM ('NEW', 'QUALIFIED', 'TARGET', 'PROPOSAL')`);
    await tx.$executeRawUnsafe(`CREATE TABLE "client" (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, UNIQUE (id, org_id))`);
    await tx.$executeRawUnsafe(`CREATE TABLE "project" (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES "client"(id) ON DELETE CASCADE)`);
    await tx.$executeRawUnsafe(`CREATE TABLE "lead_column" (
      id TEXT PRIMARY KEY, org_id TEXT NOT NULL, client_id TEXT, name TEXT NOT NULL, after_stage "lead_stage", position INT NOT NULL,
      CONSTRAINT "lead_column_client_id_org_id_fkey" FOREIGN KEY (client_id, org_id) REFERENCES "client"(id, org_id))`);
    await tx.$executeRawUnsafe(`CREATE INDEX "lead_column_org_id_client_id_after_stage_position_idx" ON "lead_column"(org_id, client_id, after_stage, position)`);
    await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "lead_column_board_name_key" ON "lead_column" (org_id, coalesce(client_id, ''), lower(name))`);
    await tx.$executeRawUnsafe(`CREATE TABLE "lead" (
      id TEXT PRIMARY KEY, org_id TEXT NOT NULL, client_id TEXT, project_id TEXT, name TEXT NOT NULL,
      stage "lead_stage", column_id TEXT REFERENCES "lead_column"(id), position INT NOT NULL,
      CONSTRAINT "lead_client_id_org_id_fkey" FOREIGN KEY (client_id, org_id) REFERENCES "client"(id, org_id),
      CONSTRAINT "lead_project_id_fkey" FOREIGN KEY (project_id) REFERENCES "project"(id) ON DELETE SET NULL,
      CONSTRAINT "lead_stage_or_column_check" CHECK ((stage IS NULL) <> (column_id IS NULL)))`);
    await tx.$executeRawUnsafe(`CREATE INDEX "lead_org_id_client_id_stage_position_idx" ON "lead"(org_id, client_id, stage, position)`);
    await tx.$executeRawUnsafe(`CREATE INDEX "lead_project_id_idx" ON "lead"(project_id)`);
    await tx.$executeRawUnsafe(`INSERT INTO "client" VALUES ('c1', 'o1'), ('c2', 'o1')`);
    await tx.$executeRawUnsafe(`INSERT INTO "project" VALUES ('pA', 'c1'), ('pB', 'c1'), ('pC', 'c2')`);
    await tx.$executeRawUnsafe(`INSERT INTO "lead_column" VALUES
      ('meeting', 'o1', 'c1', 'Встреча', 'PROPOSAL', 0),
      ('agency-col', 'o1', NULL, 'Агентская', 'PROPOSAL', 0)`);
    await tx.$executeRawUnsafe(`INSERT INTO "lead" VALUES
      ('agency-attributed', 'o1', NULL, 'pA', 'x', 'NEW', NULL, 0),
      ('agency-in-column', 'o1', NULL, NULL, 'x', NULL, 'agency-col', 0),
      ('unattributed', 'o1', 'c1', NULL, 'x', 'NEW', NULL, 0),
      ('a-first', 'o1', 'c1', 'pA', 'x', 'NEW', NULL, 1),
      ('b-first', 'o1', 'c1', 'pB', 'x', 'NEW', NULL, 2),
      ('a-second', 'o1', 'c1', 'pA', 'x', 'NEW', NULL, 3),
      ('a-in-column', 'o1', 'c1', 'pA', 'x', NULL, 'meeting', 0),
      ('b-qualified', 'o1', 'c1', 'pB', 'x', 'QUALIFIED', NULL, 4),
      ('c-first', 'o1', 'c2', 'pC', 'x', 'NEW', NULL, 7)`);

    for (const statement of sql.split(";").filter((part) => part.trim())) await tx.$executeRawUnsafe(statement);

    const leads = await tx.$queryRawUnsafe<Array<{ id: string; project_id: string; stage: string; column_id: string | null; position: number }>>(
      `SELECT id, project_id, stage::text AS stage, column_id, position FROM "lead" ORDER BY project_id, stage, position`,
    );
    expect(leads).toEqual([
      { id: "a-first", project_id: "pA", stage: "NEW", column_id: null, position: 0 },
      { id: "a-second", project_id: "pA", stage: "NEW", column_id: null, position: 1 },
      { id: "a-in-column", project_id: "pA", stage: "NEW", column_id: null, position: 2 },
      { id: "b-first", project_id: "pB", stage: "NEW", column_id: null, position: 0 },
      { id: "b-qualified", project_id: "pB", stage: "QUALIFIED", column_id: null, position: 0 },
      { id: "c-first", project_id: "pC", stage: "NEW", column_id: null, position: 0 },
    ]);
    const [{ columns }] = await tx.$queryRawUnsafe<Array<{ columns: bigint }>>(`SELECT count(*) AS columns FROM "lead_column"`);
    expect(Number(columns)).toBe(0);

    await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });
});
