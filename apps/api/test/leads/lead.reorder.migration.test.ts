import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";

afterAll(() => prisma.$disconnect());

it("renumbers every existing lead newest-created-first, per board and per fixed stage or custom column", async () => {
  const schema = `migration_${randomUUID().replaceAll("-", "")}`;
  const sql = readFileSync(new URL("../../prisma/migrations/20260921120000_reorder_leads_newest_first/migration.sql", import.meta.url), "utf8");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe(
      "CREATE TABLE lead (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, client_id TEXT, stage TEXT, column_id TEXT, position INT NOT NULL, created_at TIMESTAMP(3) NOT NULL)",
    );
    await tx.$executeRawUnsafe(`INSERT INTO lead (id, org_id, client_id, stage, column_id, position, created_at) VALUES
      ('new-1', 'org-a', 'client-a', 'NEW', NULL, 0, '2026-09-01T00:00:00Z'),
      ('new-2', 'org-a', 'client-a', 'NEW', NULL, 1, '2026-09-02T00:00:00Z'),
      ('new-3', 'org-a', 'client-a', 'NEW', NULL, 2, '2026-09-03T00:00:00Z'),
      ('agency-1', 'org-a', NULL, 'NEW', NULL, 0, '2026-09-01T00:00:00Z'),
      ('agency-2', 'org-a', NULL, 'NEW', NULL, 1, '2026-09-04T00:00:00Z'),
      ('col-1', 'org-a', 'client-a', NULL, 'column-x', 5, '2026-09-01T00:00:00Z'),
      ('col-2', 'org-a', 'client-a', NULL, 'column-x', 6, '2026-09-05T00:00:00Z'),
      ('other-org', 'org-b', 'client-a', 'NEW', NULL, 0, '2026-09-01T00:00:00Z')`);

    for (const statement of sql.split(";").filter((part) => part.trim())) await tx.$executeRawUnsafe(statement);

    const rows = await tx.$queryRawUnsafe<Array<{ id: string; position: number }>>(
      "SELECT id, position FROM lead ORDER BY id",
    );
    expect(Object.fromEntries(rows.map((row) => [row.id, row.position]))).toEqual({
      "new-1": 2, "new-2": 1, "new-3": 0,
      "agency-1": 1, "agency-2": 0,
      "col-1": 1, "col-2": 0,
      "other-org": 0,
    });

    const unchanged = await tx.$queryRawUnsafe<Array<{ id: string; org_id: string; client_id: string | null; stage: string | null; column_id: string | null }>>(
      "SELECT id, org_id, client_id, stage, column_id FROM lead ORDER BY id",
    );
    expect(unchanged.find((row) => row.id === "col-1")).toMatchObject({ org_id: "org-a", client_id: "client-a", stage: null, column_id: "column-x" });

    await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });
});
