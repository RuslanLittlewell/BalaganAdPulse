import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
it("applies the integration migration to populated legacy tables without changing their rows", async () => {
  const schema = `migration_${randomUUID().replaceAll("-", "")}`;
  const sql = readFileSync(new URL("../../prisma/migrations/20260908220000_meta_integration/migration.sql", import.meta.url), "utf8");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe('CREATE TABLE project (id TEXT PRIMARY KEY, name TEXT NOT NULL)');
    await tx.$executeRawUnsafe('CREATE TABLE campaign (id TEXT PRIMARY KEY, project_id TEXT REFERENCES project(id), name TEXT NOT NULL)');
    await tx.$executeRaw`INSERT INTO project VALUES ('old-project', 'Existing project')`;
    await tx.$executeRaw`INSERT INTO campaign VALUES ('old-campaign', 'old-project', 'Existing campaign')`;
    for (const statement of sql.split(';').filter((part) => part.trim())) await tx.$executeRawUnsafe(statement);
    expect(await tx.$queryRaw`SELECT * FROM project`).toEqual([{ id: "old-project", name: "Existing project" }]);
    expect(await tx.$queryRaw`SELECT * FROM campaign`).toEqual([{ id: "old-campaign", project_id: "old-project", name: "Existing campaign" }]);
    expect(await tx.$queryRaw`SELECT * FROM project_integration`).toEqual([]);
    await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });
});
