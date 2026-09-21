import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";

afterAll(() => prisma.$disconnect());

it("backfills every existing custom column to sit after PROPOSAL", async () => {
  const schema = `migration_${randomUUID().replaceAll("-", "")}`;
  const sql = readFileSync(new URL("../../prisma/migrations/20260921130000_lead_column_after_stage/migration.sql", import.meta.url), "utf8");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe(`CREATE TYPE "lead_stage" AS ENUM ('NEW', 'QUALIFIED', 'TARGET', 'PROPOSAL')`);
    await tx.$executeRawUnsafe(
      `CREATE TABLE "lead_column" (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, client_id TEXT, name TEXT NOT NULL, position INT NOT NULL)`,
    );
    await tx.$executeRawUnsafe(`CREATE INDEX "lead_column_org_id_client_id_position_idx" ON "lead_column"("org_id", "client_id", "position")`);
    await tx.$executeRawUnsafe(`INSERT INTO "lead_column" (id, org_id, client_id, name, position) VALUES
      ('col-1', 'org-a', 'client-a', 'Встреча', 0),
      ('col-2', 'org-a', 'client-a', 'Договор', 1),
      ('col-3', 'org-a', NULL, 'Агентство', 0)`);

    for (const statement of sql.split(";").filter((part) => part.trim())) await tx.$executeRawUnsafe(statement);

    const rows = await tx.$queryRawUnsafe<Array<{ id: string; after_stage: string; position: number }>>(
      "SELECT id, after_stage, position FROM lead_column ORDER BY id",
    );
    expect(rows).toEqual([
      { id: "col-1", after_stage: "PROPOSAL", position: 0 },
      { id: "col-2", after_stage: "PROPOSAL", position: 1 },
      { id: "col-3", after_stage: "PROPOSAL", position: 0 },
    ]);

    await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });
});
