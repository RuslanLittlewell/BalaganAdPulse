import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";

afterAll(() => prisma.$disconnect());

const statementsOf = (sql: string) => sql.split(";")
  .map((statement) => statement.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n").trim())
  .filter(Boolean);

it("marks every existing membership as welcomed and its list as hidden, and leaves new ones blank", async () => {
  const schema = `migration_${randomUUID().replaceAll("-", "")}`;
  const sql = readFileSync(new URL("../../prisma/migrations/20261107120000_first_login_onboarding/migration.sql", import.meta.url), "utf8");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe('CREATE TABLE "membership" (id TEXT PRIMARY KEY)');
    await tx.$executeRawUnsafe(`INSERT INTO "membership" VALUES ('anna'), ('boris')`);

    for (const statement of statementsOf(sql)) await tx.$executeRawUnsafe(statement);
    await tx.$executeRawUnsafe(`INSERT INTO "membership" (id) VALUES ('newcomer')`);

    const rows = await tx.$queryRawUnsafe<Array<{ id: string; welcomed: boolean; hidden: boolean }>>(
      'SELECT id, welcomed_at IS NOT NULL AS welcomed, onboarding_hidden_at IS NOT NULL AS hidden FROM "membership" ORDER BY id',
    );
    expect(rows).toEqual([
      { id: "anna", welcomed: true, hidden: true },
      { id: "boris", welcomed: true, hidden: true },
      { id: "newcomer", welcomed: false, hidden: false },
    ]);

    await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });
});
