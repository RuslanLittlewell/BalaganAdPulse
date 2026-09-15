import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";

afterAll(() => prisma.$disconnect());

it("gives customers whole-client reach, promotes client registrants and leaves staff grants alone", async () => {
  const schema = `migration_${randomUUID().replaceAll("-", "")}`;
  const sql = readFileSync(new URL("../../prisma/migrations/20260915120000_client_account_reach/migration.sql", import.meta.url), "utf8");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe("CREATE TABLE membership (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, org_id TEXT NOT NULL, role TEXT NOT NULL)");
    await tx.$executeRawUnsafe("CREATE TABLE client_access (id TEXT PRIMARY KEY, membership_id TEXT NOT NULL, client_id TEXT NOT NULL, project_id TEXT, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)");
    await tx.$executeRawUnsafe("CREATE TABLE invite (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, registration_type TEXT NOT NULL, used_by_id TEXT)");
    await tx.$executeRawUnsafe(`INSERT INTO membership VALUES
      ('registrant', 'user-registrant', 'org', 'CLIENT'),
      ('colleague', 'user-colleague', 'org', 'CLIENT'),
      ('principal', 'user-principal', 'org', 'CLIENT_ADMIN'),
      ('manager', 'user-manager', 'org', 'MANAGER')`);
    await tx.$executeRawUnsafe(`INSERT INTO client_access (id, membership_id, client_id, project_id) VALUES
      ('a1', 'registrant', 'client-a', 'project-a1'),
      ('a2', 'colleague', 'client-b', 'project-b1'),
      ('a3', 'colleague', 'client-b', 'project-b2'),
      ('a4', 'principal', 'client-c', NULL),
      ('a5', 'principal', 'client-c', 'project-c1'),
      ('a6', 'manager', 'client-a', 'project-a1')`);
    await tx.$executeRawUnsafe(`INSERT INTO invite VALUES
      ('i1', 'org', 'CLIENT', 'user-registrant'),
      ('i2', 'org', 'CLIENT_STAFF', 'user-colleague')`);

    for (const statement of sql.split(";").filter((part) => part.trim())) await tx.$executeRawUnsafe(statement);

    const grants = await tx.$queryRawUnsafe<Array<{ membership_id: string; client_id: string; project_id: string | null }>>(
      "SELECT membership_id, client_id, project_id FROM client_access ORDER BY membership_id, client_id, project_id NULLS FIRST",
    );
    expect(grants).toEqual([
      { membership_id: "colleague", client_id: "client-b", project_id: null },
      { membership_id: "manager", client_id: "client-a", project_id: "project-a1" },
      { membership_id: "principal", client_id: "client-c", project_id: null },
      { membership_id: "registrant", client_id: "client-a", project_id: null },
    ]);
    const roles = await tx.$queryRawUnsafe<Array<{ id: string; role: string }>>("SELECT id, role FROM membership ORDER BY id");
    expect(roles).toEqual([
      { id: "colleague", role: "CLIENT" },
      { id: "manager", role: "MANAGER" },
      { id: "principal", role: "CLIENT_ADMIN" },
      { id: "registrant", role: "CLIENT_ADMIN" },
    ]);
    await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });
});
