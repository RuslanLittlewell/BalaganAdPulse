import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";
import { expectAudit } from "../helpers/audit.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let projectId: string;
let auth: { Authorization: string };

beforeEach(async () => {
  await resetDb();
  const signedIn = await signInAs();
  ({ auth } = signedIn);
  ({ projectId } = await seedProject(signedIn.user.id));
});
afterAll(async () => { await prisma.$disconnect(); });

describe("Campaigns API", () => {
  it("POST /api/projects/:projectId/campaigns creates (201)", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/campaigns`).set(auth).send({ name: "Facebook — July" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Facebook — July");
    expect(res.body.position).toBe(0);
    await expectAudit({ action: "CREATE", entityType: "campaign", entityId: res.body.id, projectId, campaignId: res.body.id });
  });

  it("POST with an empty name -> 400", async () => {
    const res = await request(app).post(`/api/projects/${projectId}/campaigns`).set(auth).send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("POST for a missing client -> 404", async () => {
    const res = await request(app).post(`/api/projects/${MISSING}/campaigns`).set(auth).send({ name: "A" });
    expect(res.status).toBe(404);
  });

  it("GET /api/projects/:projectId/campaigns lists (200)", async () => {
    await request(app).post(`/api/projects/${projectId}/campaigns`).set(auth).send({ name: "A" });
    const res = await request(app).get(`/api/projects/${projectId}/campaigns`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("GET /api/campaigns/:id returns properties, records and totals (200)", async () => {
    const created = await request(app)
      .post(`/api/projects/${projectId}/campaigns`).set(auth).send({ name: "A" });
    const res = await request(app).get(`/api/campaigns/${created.body.id}`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.properties).toHaveLength(11);
    expect(res.body.records).toEqual([]);
    expect(Object.keys(res.body.totals)).toHaveLength(11);
    expect(res.body.properties[0]).toMatchObject({ key: "spend", type: "MONEY", position: 0 });
  });

  it("GET /api/campaigns/:id for a missing id -> 404", async () => {
    expect((await request(app).get(`/api/campaigns/${MISSING}`).set(auth)).status).toBe(404);
  });

  it("PATCH /api/campaigns/:id renames (200)", async () => {
    const created = await request(app)
      .post(`/api/projects/${projectId}/campaigns`).set(auth).send({ name: "A" });
    const res = await request(app).patch(`/api/campaigns/${created.body.id}`).set(auth).send({ name: "B" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("B");
    await expectAudit({ action: "UPDATE", entityType: "campaign", entityId: created.body.id, projectId, campaignId: created.body.id });
  });

  it("DELETE /api/campaigns/:id deletes (204)", async () => {
    const created = await request(app)
      .post(`/api/projects/${projectId}/campaigns`).set(auth).send({ name: "A" });
    expect((await request(app).delete(`/api/campaigns/${created.body.id}`).set(auth)).status).toBe(204);
    expect(await prisma.campaign.count()).toBe(0);
    await expectAudit({ action: "DELETE", entityType: "campaign", entityId: created.body.id, projectId, campaignId: created.body.id });
  });

  it("GET /api/campaigns/:id for an unreachable campaign -> 404", async () => {
    const other = await signInAs("Other", { role: "MANAGER" });
    const stranger = await signInAs("Stranger", { role: "MANAGER" });
    const theirClient = await request(app).post("/api/clients").set(other.auth)
      .send({ name: "Theirs" });
    const theirProject = await request(app).post("/api/projects").set(other.auth)
      .send({ clientId: theirClient.body.id, name: "Theirs" });
    const theirCampaigns = await request(app)
      .get(`/api/projects/${theirProject.body.id}/campaigns`).set(other.auth);

    const res = await request(app)
      .get(`/api/campaigns/${theirCampaigns.body[0].id}`).set(stranger.auth);
    expect(res.status).toBe(404);
  });

  it("GET /api/projects/:projectId/campaigns for an unreachable client -> 404", async () => {
    const other = await signInAs("Other", { role: "MANAGER" });
    const stranger = await signInAs("Stranger", { role: "MANAGER" });
    const theirClient = await request(app).post("/api/clients").set(other.auth)
      .send({ name: "Theirs" });

    const res = await request(app)
      .get(`/api/clients/${theirClient.body.id}/campaigns`).set(stranger.auth);
    expect(res.status).toBe(404);
  });
});
