import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";

afterAll(() => prisma.$disconnect());

it("moves the KPIs naming no account to the project's only account, and leaves every other KPI alone", async () => {
  const schema = `migration_${randomUUID().replaceAll("-", "")}`;
  const sql = readFileSync(new URL("../../prisma/migrations/20261027110000_project_kpi_only_account/migration.sql", import.meta.url), "utf8");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe("CREATE TYPE channel AS ENUM ('META', 'GOOGLE', 'YANDEX', 'VK', 'TIKTOK', 'LINKEDIN', 'TELEGRAM')");
    await tx.$executeRawUnsafe("CREATE TABLE campaign (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, channel channel NOT NULL, source_account_id TEXT)");
    await tx.$executeRawUnsafe("CREATE TABLE project_integration (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, provider TEXT NOT NULL, account_id TEXT NOT NULL)");
    await tx.$executeRawUnsafe("CREATE TABLE project_kpi (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, channel channel, source_account_id TEXT)");
    await tx.$executeRawUnsafe(`INSERT INTO campaign VALUES
      ('c1', 'one', 'META', '111'), ('c2', 'one', 'META', '111'),
      ('c3', 'two', 'META', '111'), ('c4', 'two', 'META', '222'),
      ('c5', 'imported', 'META', NULL),
      ('c6', 'mixed', 'META', '111')`);
    await tx.$executeRawUnsafe(`INSERT INTO project_integration VALUES
      ('i1', 'one', 'META', '111'), ('i2', 'connected', 'META', '333'), ('i3', 'mixed', 'GOOGLE', '111')`);
    await tx.$executeRawUnsafe(`INSERT INTO project_kpi VALUES
      ('one-common', 'one', NULL, NULL),
      ('two-common', 'two', NULL, NULL),
      ('two-named', 'two', 'META', '222'),
      ('connected-common', 'connected', NULL, NULL),
      ('imported-common', 'imported', NULL, NULL),
      ('mixed-common', 'mixed', NULL, NULL),
      ('bare-common', 'bare', NULL, NULL)`);

    await tx.$executeRawUnsafe(sql);

    const rows = await tx.$queryRawUnsafe<Array<{ id: string; channel: string | null; source_account_id: string | null }>>(
      "SELECT id, channel::text AS channel, source_account_id FROM project_kpi ORDER BY id",
    );
    expect(Object.fromEntries(rows.map((row) => [row.id, row.channel && `${row.channel}:${row.source_account_id}`]))).toEqual({
      "one-common": "META:111",
      "two-common": null,
      "two-named": "META:222",
      "connected-common": "META:333",
      "imported-common": null,
      "mixed-common": null,
      "bare-common": null,
    });

    await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });
});
