import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs } from "../helpers/auth.js";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

it("moves leads out of removed stages to the end of NEW, keeps the rest and rebuilds the stages", async () => {
  const schema = `migration_${randomUUID().replaceAll("-", "")}`;
  const sql = readFileSync(new URL("../../prisma/migrations/20260915140000_custom_crm_columns/migration.sql", import.meta.url), "utf8");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe("CREATE TYPE lead_stage AS ENUM ('NEW','CONTACTED','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST','DEFERRED')");
    await tx.$executeRawUnsafe("CREATE TABLE organization (id TEXT PRIMARY KEY)");
    await tx.$executeRawUnsafe("CREATE TABLE client (id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organization(id), UNIQUE (id, org_id))");
    await tx.$executeRawUnsafe(`CREATE TABLE lead (
      id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organization(id), client_id TEXT, name TEXT NOT NULL,
      stage lead_stage NOT NULL DEFAULT 'NEW', position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (client_id, org_id) REFERENCES client(id, org_id))`);
    await tx.$executeRawUnsafe("CREATE INDEX lead_org_id_client_id_stage_position_idx ON lead (org_id, client_id, stage, position)");
    await tx.$executeRawUnsafe("INSERT INTO organization VALUES ('org')");
    await tx.$executeRawUnsafe("INSERT INTO client VALUES ('c1', 'org')");
    await tx.$executeRawUnsafe(`INSERT INTO lead (id, org_id, client_id, name, stage, position) VALUES
      ('n1', 'org', 'c1', 'New one', 'NEW', 0),
      ('n2', 'org', 'c1', 'New two', 'NEW', 1),
      ('w', 'org', 'c1', 'Won', 'WON', 0),
      ('c', 'org', 'c1', 'Contacted', 'CONTACTED', 0),
      ('d', 'org', 'c1', 'Deferred', 'DEFERRED', 0),
      ('c2', 'org', 'c1', 'Contacted two', 'CONTACTED', 1),
      ('q', 'org', 'c1', 'Qualified', 'QUALIFIED', 0),
      ('p', 'org', 'c1', 'Proposal', 'PROPOSAL', 0),
      ('l', 'org', NULL, 'Lost on agency', 'LOST', 3)`);

    for (const statement of sql.split(";").filter((part) => part.trim())) await tx.$executeRawUnsafe(statement);

    const leads = await tx.$queryRawUnsafe<Array<{ id: string; client_id: string | null; stage: string | null; position: number; column_id: string | null }>>(
      "SELECT id, client_id, stage::text AS stage, position, column_id FROM lead ORDER BY client_id NULLS FIRST, lead.stage, position",
    );
    expect(leads).toEqual([
      { id: "l", client_id: null, stage: "NEW", position: 0, column_id: null },
      { id: "n1", client_id: "c1", stage: "NEW", position: 0, column_id: null },
      { id: "n2", client_id: "c1", stage: "NEW", position: 1, column_id: null },
      { id: "c", client_id: "c1", stage: "NEW", position: 2, column_id: null },
      { id: "c2", client_id: "c1", stage: "NEW", position: 3, column_id: null },
      { id: "w", client_id: "c1", stage: "NEW", position: 4, column_id: null },
      { id: "d", client_id: "c1", stage: "NEW", position: 5, column_id: null },
      { id: "q", client_id: "c1", stage: "QUALIFIED", position: 0, column_id: null },
      { id: "p", client_id: "c1", stage: "PROPOSAL", position: 0, column_id: null },
    ]);
    const [{ stages }] = await tx.$queryRawUnsafe<Array<{ stages: string }>>("SELECT enum_range(NULL::lead_stage)::text AS stages");
    expect(stages).toBe("{NEW,QUALIFIED,TARGET,PROPOSAL}");
    await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });
});

describe("custom board columns", () => {
  async function board() {
    const member = await signInAs();
    const { clientId, projectId } = await seedProject(member.user.id);
    const other = await prisma.project.create({ data: { clientId, name: "Второй", position: 1 } });
    return { orgId: (await currentOrg()).id, clientId, projectId, otherProjectId: other.id };
  }

  it("puts a lead in exactly one of a fixed stage or a custom column", async () => {
    const { orgId, projectId } = await board();
    const column = await prisma.leadColumn.create({ data: { orgId, projectId, name: "Встреча", position: 0 } });

    await expect(prisma.lead.create({ data: { name: "Both", orgId, projectId, stage: "NEW", columnId: column.id } })).rejects.toThrow();
    await expect(prisma.lead.create({ data: { name: "Neither", orgId, projectId, stage: null } })).rejects.toThrow();
    await expect(prisma.lead.create({ data: { name: "Custom", orgId, projectId, stage: null, columnId: column.id } })).resolves.toMatchObject({ columnId: column.id, stage: null });
    await expect(prisma.lead.create({ data: { name: "Target", orgId, projectId, stage: "TARGET" } })).resolves.toMatchObject({ stage: "TARGET" });
  });

  it("refuses deleting a column that still holds leads", async () => {
    const { orgId, projectId } = await board();
    const column = await prisma.leadColumn.create({ data: { orgId, projectId, name: "Встреча", position: 0 } });
    await prisma.lead.create({ data: { name: "Custom", orgId, projectId, stage: null, columnId: column.id } });

    await expect(prisma.leadColumn.delete({ where: { id: column.id } })).rejects.toThrow();
  });

  it("disappears with its project, leads included", async () => {
    const { orgId, projectId } = await board();
    const column = await prisma.leadColumn.create({ data: { orgId, projectId, name: "Встреча", position: 0 } });
    await prisma.lead.create({ data: { name: "Custom", orgId, projectId, stage: null, columnId: column.id } });

    await prisma.project.delete({ where: { id: projectId } });

    expect(await prisma.leadColumn.count()).toBe(0);
    expect(await prisma.lead.count({ where: { orgId } })).toBe(0);
  });

  it("keeps names unique on a board regardless of case, and free across boards", async () => {
    const { orgId, projectId, otherProjectId } = await board();
    await prisma.leadColumn.create({ data: { orgId, projectId, name: "Встреча", position: 0 } });

    await expect(prisma.leadColumn.create({ data: { orgId, projectId, name: "ВСТРЕЧА", position: 1 } })).rejects.toThrow();
    await expect(prisma.leadColumn.create({ data: { orgId, projectId: otherProjectId, name: "Встреча", position: 0 } })).resolves.toMatchObject({ projectId: otherProjectId });
    await expect(prisma.leadColumn.create({ data: { orgId, projectId: otherProjectId, name: "встреча", position: 1 } })).rejects.toThrow();
  });
});
