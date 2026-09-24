import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs } from "../helpers/auth.js";

const app = createApp();
let admin: { Authorization: string };
let clientId: string;
let projectId: string;

beforeEach(async () => {
  await resetDb();
  ({ auth: admin } = await signInAs("Admin", { role: "ADMIN" }));
  ({ clientId, projectId } = await seedProject("unused", "Клиника"));
});

afterAll(() => prisma.$disconnect());

async function customer(role: "CLIENT" | "CLIENT_ADMIN" = "CLIENT") {
  const member = await signInAs(role, { role });
  await grantAccess(member.membership!.id, clientId);
  return member.auth;
}

describe("a customer managing their client's projects", () => {
  it.each(["CLIENT", "CLIENT_ADMIN"] as const)("lets a %s create a project the agency then sees", async (role) => {
    const auth = await customer(role);
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId);

    const created = await request(app).post("/api/projects").set(auth)
      .send({ clientId, name: "Имплантация", budgetCurrency: "USD" });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ clientId, name: "Имплантация", priority: "NEW" });
    for (const reader of [admin, manager.auth]) {
      const listed = await request(app).get("/api/projects").set(reader);
      expect(listed.body.map((project: { name: string }) => project.name)).toContain("Имплантация");
    }
    const event = await prisma.auditEvent.findFirstOrThrow({ where: { entityId: created.body.id, action: "CREATE" } });
    expect(event.actorRole).toBe(role);
  });

  it("refuses a project for another client as though it did not exist", async () => {
    const auth = await customer();
    const other = await seedProject("unused", "Другой");

    const refused = await request(app).post("/api/projects").set(auth).send({ clientId: other.clientId, name: "Чужой" });

    expect(refused.status).toBe(404);
    expect(await prisma.project.count({ where: { name: "Чужой" } })).toBe(0);
  });

  it("lets a customer edit the name, the currency and the picture of their client's project", async () => {
    const auth = await customer("CLIENT_ADMIN");

    const updated = await request(app).patch(`/api/projects/${projectId}`).set(auth)
      .send({ name: "Клиника 2.0", budgetCurrency: "EUR" });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ name: "Клиника 2.0", budgetCurrency: "EUR" });
  });

  it("keeps deletion and priority with the agency", async () => {
    const auth = await customer();

    expect((await request(app).delete(`/api/projects/${projectId}`).set(auth)).status).toBe(403);
    expect((await request(app).patch(`/api/projects/${projectId}`).set(auth).send({ priority: "CRITICAL" })).status).toBe(403);
    expect((await request(app).post("/api/projects").set(auth).send({ clientId, name: "Срочный", priority: "CRITICAL" })).status).toBe(403);
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ priority: "NEW" });
    expect(await prisma.project.count({ where: { name: "Срочный" } })).toBe(0);
    expect((await request(app).patch(`/api/projects/${projectId}`).set(admin).send({ priority: "CRITICAL" })).status).toBe(200);
  });

  it("keeps the Meta connection and KPIs with the agency", async () => {
    const auth = await customer("CLIENT_ADMIN");
    const campaign = await seedCampaign(projectId);

    expect((await request(app).get(`/api/projects/${projectId}/integrations/meta`).set(auth)).status).toBe(403);
    expect((await request(app).put(`/api/projects/${projectId}/integrations/meta`).set(auth).send({ accountId: "123", token: "secret" })).status).toBe(403);
    expect((await request(app).post(`/api/projects/${projectId}/integrations/meta/sync`).set(auth)).status).toBe(403);
    expect((await request(app).put(`/api/projects/${projectId}/kpi`).set(auth).send({ metric: "CONVERSIONS", target: "10" })).status).toBe(403);
    expect((await request(app).put(`/api/campaigns/${campaign.id}/kpi`).set(auth).send({ metric: "CPA", target: "10" })).status).toBe(403);
    expect((await request(app).get(`/api/projects/${projectId}/kpi`).set(auth)).status).toBe(200);
  });
});
