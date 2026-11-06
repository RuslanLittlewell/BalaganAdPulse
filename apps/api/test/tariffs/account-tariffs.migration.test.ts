import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";

afterAll(() => prisma.$disconnect());

const statementsOf = (sql: string) => sql.split(";")
  .map((statement) => statement.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n").trim())
  .filter(Boolean);

it("moves every existing organization to Enterprise with no trial, and starts new ones on the trial", async () => {
  const schema = `migration_${randomUUID().replaceAll("-", "")}`;
  const sql = readFileSync(new URL("../../prisma/migrations/20261106120000_account_tariffs/migration.sql", import.meta.url), "utf8");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe(`CREATE TYPE "org_module" AS ENUM ('CRM', 'TASKS', 'REPORTS')`);
    await tx.$executeRawUnsafe(`CREATE TABLE "organization" (
      id TEXT PRIMARY KEY,
      modules "org_module"[] NOT NULL DEFAULT ARRAY['CRM', 'TASKS', 'REPORTS']::"org_module"[]
    )`);
    await tx.$executeRawUnsafe(`INSERT INTO "organization" (id, modules) VALUES
      ('balagan', ARRAY['CRM', 'TASKS', 'REPORTS']::"org_module"[]),
      ('lean', ARRAY[]::"org_module"[])`);

    for (const statement of statementsOf(sql)) await tx.$executeRawUnsafe(statement);
    await tx.$executeRawUnsafe(`INSERT INTO "organization" (id) VALUES ('newcomer')`);

    const rows = await tx.$queryRawUnsafe<Array<{ id: string; tariff: string; trial_ends_at: Date | null }>>(
      'SELECT id, tariff::text AS tariff, trial_ends_at FROM "organization" ORDER BY id',
    );
    expect(rows).toEqual([
      { id: "balagan", tariff: "ENTERPRISE", trial_ends_at: null },
      { id: "lean", tariff: "ENTERPRISE", trial_ends_at: null },
      { id: "newcomer", tariff: "TRIAL", trial_ends_at: null },
    ]);
    const columns = await tx.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = '${schema}' AND table_name = 'organization' ORDER BY column_name`,
    );
    expect(columns.map(({ column_name }) => column_name)).toEqual(["id", "tariff", "trial_ends_at"]);

    await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });
});
