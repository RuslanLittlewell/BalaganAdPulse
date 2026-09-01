import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { AuditAction } from "@prisma/client";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb } from "../helpers/db.js";
import { currentOrg, grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";

const app = createApp();
let admin: Awaited<ReturnType<typeof signInAs>>;
let manager: Awaited<ReturnType<typeof signInAs>>;
let clientA: { id: string };
let clientB: { id: string };
let projectA: { id: string };
let projectB: { id: string };
let campaignA: { id: string };
let campaignB: { id: string };

async function event(input: {
  entityType: string;
  entityId: string;
  action?: AuditAction;
  clientId?: string;
  projectId?: string;
  campaignId?: string;
  actorId?: string;
  createdAt: string;
}) {
  const actor = input.actorId ?? admin.membership!.id;
  const membership = await prisma.membership.findUniqueOrThrow({
    where: { id: actor }, include: { user: true },
  });
  return prisma.auditEvent.create({
    data: {
      orgId: membership.orgId,
      actorId: actor,
      actorName: membership.user.name,
      actorEmail: membership.user.email,
      actorRole: membership.role,
      action: input.action ?? "UPDATE",
      entityType: input.entityType,
      entityId: input.entityId,
      clientId: input.clientId,
      projectId: input.projectId,
      campaignId: input.campaignId,
      summary: `${input.action ?? "UPDATE"} ${input.entityType}`,
      createdAt: new Date(input.createdAt),
    },
  });
}

beforeEach(async () => {
  await resetDb();
  admin = await signInAs("Audit Admin", { role: "ADMIN" });
  manager = await signInAs("Audit Manager", { role: "MANAGER" });
  const org = await currentOrg();
  clientA = await prisma.client.create({ data: { name: "A", orgId: org.id } });
  clientB = await prisma.client.create({ data: { name: "B", orgId: org.id } });
  projectA = await prisma.project.create({ data: { name: "PA", clientId: clientA.id, position: 0 } });
  projectB = await prisma.project.create({ data: { name: "PB", clientId: clientB.id, position: 0 } });
  campaignA = await prisma.campaign.create({ data: { name: "CA", projectId: projectA.id, position: 0 } });
  campaignB = await prisma.campaign.create({ data: { name: "CB", projectId: projectB.id, position: 0 } });
  await grantAccess(manager.membership!.id, clientA.id);

  await event({ entityType: "client", entityId: clientA.id, clientId: clientA.id, action: "CREATE", createdAt: "2026-08-01T10:00:00Z" });
  await event({ entityType: "project", entityId: projectA.id, clientId: clientA.id, projectId: projectA.id, createdAt: "2026-08-02T10:00:00Z" });
  await event({ entityType: "campaign", entityId: campaignA.id, clientId: clientA.id, projectId: projectA.id, campaignId: campaignA.id, actorId: manager.membership!.id, createdAt: "2026-08-03T10:00:00Z" });
  await event({ entityType: "project", entityId: projectB.id, clientId: clientB.id, projectId: projectB.id, createdAt: "2026-08-04T10:00:00Z" });
  await event({ entityType: "campaign", entityId: campaignB.id, clientId: clientB.id, projectId: projectB.id, campaignId: campaignB.id, createdAt: "2026-08-05T10:00:00Z" });
});
afterAll(async () => { await prisma.$disconnect(); });

describe("GET /api/audit", () => {
  it("returns only reachable events, newest first", async () => {
    const response = await request(app).get("/api/audit").set(manager.auth);
    expect(response.status).toBe(200);
    expect(response.body.items.map((item: { entityId: string }) => item.entityId))
      .toEqual([campaignA.id, projectA.id, clientA.id]);
  });

  it("never returns another organization's events", async () => {
    const outsider = await signInAsOutsider();
    await event({
      entityType: "client", entityId: outsider.client.id, clientId: outsider.client.id,
      actorId: outsider.membership.id, createdAt: "2026-08-06T10:00:00Z",
    });
    const response = await request(app).get("/api/audit").set(admin.auth);
    expect(response.body.items.some((item: { entityId: string }) => item.entityId === outsider.client.id)).toBe(false);
  });

  it.each([
    ["clientId", () => clientA.id, 3],
    ["projectId", () => projectA.id, 2],
    ["campaignId", () => campaignA.id, 1],
    ["entityType", () => "campaign", 2],
    ["entityId", () => campaignA.id, 1],
    ["actorId", () => manager.membership!.id, 1],
  ])("filters by %s", async (key, value, count) => {
    const response = await request(app).get("/api/audit").query({ [key]: value() }).set(admin.auth);
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(count);
  });

  it("filters by an inclusive date range", async () => {
    const response = await request(app).get("/api/audit")
      .query({ from: "2026-08-02T00:00:00Z", to: "2026-08-04T23:59:59Z" }).set(admin.auth);
    expect(response.body.items.map((item: { entityId: string }) => item.entityId))
      .toEqual([projectB.id, campaignA.id, projectA.id]);
  });

  it("cursor-paginates without duplicates", async () => {
    const first = await request(app).get("/api/audit").query({ limit: 2 }).set(admin.auth);
    expect(first.body.items).toHaveLength(2);
    expect(first.body.nextCursor).toBeTypeOf("string");

    const second = await request(app).get("/api/audit")
      .query({ limit: 2, cursor: first.body.nextCursor }).set(admin.auth);
    expect(second.body.items).toHaveLength(2);
    expect(second.body.items.map((item: { id: string }) => item.id))
      .not.toContain(first.body.items[0].id);
  });
});
