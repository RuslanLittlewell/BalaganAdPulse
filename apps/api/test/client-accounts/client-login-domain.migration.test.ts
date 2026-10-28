import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";

afterAll(() => prisma.$disconnect());

it("gives every login issued without a domain the agency's, and leaves emails and full logins alone", async () => {
  const schema = `migration_${randomUUID().replaceAll("-", "")}`;
  const sql = readFileSync(new URL("../../prisma/migrations/20261028190000_client_login_domain/migration.sql", import.meta.url), "utf8");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe('CREATE TABLE "app_user" (id TEXT PRIMARY KEY, email TEXT, login TEXT)');
    await tx.$executeRawUnsafe(`INSERT INTO "app_user" VALUES
      ('bare', NULL, 'klinika-4821'),
      ('full', NULL, 'acme-1357@balagan.pro'),
      ('member', 'buyer@acme.com', NULL)`);

    await tx.$executeRawUnsafe(sql);

    const rows = await tx.$queryRawUnsafe<Array<{ id: string; email: string | null; login: string | null }>>(
      'SELECT id, email, login FROM "app_user" ORDER BY id',
    );
    expect(rows).toEqual([
      { id: "bare", email: null, login: "klinika-4821@balagan.pro" },
      { id: "full", email: null, login: "acme-1357@balagan.pro" },
      { id: "member", email: "buyer@acme.com", login: null },
    ]);

    await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });
});
