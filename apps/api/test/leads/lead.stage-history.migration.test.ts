import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";

afterAll(() => prisma.$disconnect());

type Row = { lead_id: string; from_stage: string | null; to_stage: string; changed_at: Date; processed_at: Date | null };

it("copies each lead's creation and its moves between stages from the audit log, as processed history", async () => {
  const schema = `migration_${randomUUID().replaceAll("-", "")}`;
  const sql = readFileSync(new URL("../../prisma/migrations/20261117100000_meta_crm_conversions/migration.sql", import.meta.url), "utf8");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe("CREATE TABLE project (id TEXT PRIMARY KEY)");
    await tx.$executeRawUnsafe("CREATE TABLE lead (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, project_id TEXT NOT NULL, created_at TIMESTAMP(3) NOT NULL)");
    await tx.$executeRawUnsafe("CREATE TABLE audit_event (id TEXT PRIMARY KEY, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, changes JSONB, created_at TIMESTAMP(3) NOT NULL)");
    await tx.$executeRawUnsafe("INSERT INTO project VALUES ('p1')");
    await tx.$executeRawUnsafe(`INSERT INTO lead VALUES
      ('manual', 'org', 'p1', '2026-10-01T09:00:00Z'),
      ('custom', 'org', 'p1', '2026-10-02T09:00:00Z'),
      ('imported', 'org', 'p1', '2026-10-03T09:00:00Z')`);
    await tx.$executeRawUnsafe(`INSERT INTO audit_event VALUES
      ('a1', 'CREATE', 'lead', 'manual', '{"after":{"stage":"NEW","name":"Анна"}}', '2026-10-01T09:00:00Z'),
      ('a2', 'UPDATE', 'lead', 'manual', '{"before":{"stage":"NEW","position":0},"after":{"stage":"PROPOSAL","position":0}}', '2026-10-05T12:00:00Z'),
      ('a3', 'UPDATE', 'lead', 'manual', '{"before":{"stage":"PROPOSAL","name":"Анна"},"after":{"stage":"PROPOSAL","name":"Анна К."}}', '2026-10-06T12:00:00Z'),
      ('a4', 'CREATE', 'lead', 'custom', '{"after":{"stage":"column-x"}}', '2026-10-02T09:00:00Z'),
      ('a5', 'UPDATE', 'lead', 'gone', '{"before":{"stage":"NEW"},"after":{"stage":"TARGET"}}', '2026-10-07T12:00:00Z'),
      ('a6', 'UPDATE', 'lead-column', 'column-x', '{"before":{"stage":"NEW"},"after":{"stage":"TARGET"}}', '2026-10-07T12:00:00Z')`);

    for (const statement of sql.split(";").filter((part) => part.trim())) await tx.$executeRawUnsafe(statement);

    const rows = await tx.$queryRawUnsafe<Row[]>("SELECT lead_id, from_stage, to_stage, changed_at, processed_at FROM lead_stage_change ORDER BY lead_id, changed_at");
    expect(rows.map(({ lead_id, from_stage, to_stage, changed_at }) => [lead_id, from_stage, to_stage, changed_at.toISOString()])).toEqual([
      ["custom", null, "column-x", "2026-10-02T09:00:00.000Z"],
      ["imported", null, "NEW", "2026-10-03T09:00:00.000Z"],
      ["manual", null, "NEW", "2026-10-01T09:00:00.000Z"],
      ["manual", "NEW", "PROPOSAL", "2026-10-05T12:00:00.000Z"],
    ]);
    expect(rows.every((row) => row.processed_at !== null)).toBe(true);

    await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });
});
