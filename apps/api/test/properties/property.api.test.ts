import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import type { Actor } from "@adpulse/access-policy";
import { signInAs } from "../helpers/auth.js";
import { expectAudit } from "../helpers/audit.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let campaignId: string;
let propertyIdByKey: Map<string | null, string>;
let auth: { Authorization: string };
let actor: Actor;

beforeEach(async () => {
  await resetDb();
  const signedIn = await signInAs();
  ({ auth } = signedIn);
  actor = signedIn.actor!;
  const { projectId } = await seedProject(signedIn.user.id);
  const campaign = await seedCampaign(projectId, "A");
  campaignId = campaign.id;
  const properties = await prisma.campaignProperty.findMany({ where: { campaignId } });
  propertyIdByKey = new Map(properties.map((property) => [property.key, property.id]));
});
afterAll(async () => { await prisma.$disconnect(); });

describe("Properties API", () => {
  it("POST /api/campaigns/:campaignId/properties creates (201)", async () => {
    const res = await request(app)
      .post(`/api/campaigns/${campaignId}/properties`).set(auth).send({ name: "FREQUENCY", type: "NUMBER" });
    expect(res.status).toBe(201);
    expect(res.body.position).toBe(11);
    await expectAudit({ action: "CREATE", entityType: "property", entityId: res.body.id, campaignId });
  });

  it("POST with an unknown type -> 400", async () => {
    const res = await request(app)
      .post(`/api/campaigns/${campaignId}/properties`).set(auth).send({ name: "X", type: "DATE" });
    expect(res.status).toBe(400);
  });

  it("POST with a malformed formula -> 400", async () => {
    const res = await request(app).post(`/api/campaigns/${campaignId}/properties`).set(auth)
      .send({ name: "X", type: "NUMBER", formula: { kind: "binary", op: "%" } });
    expect(res.status).toBe(400);
  });

  it("POST for a missing campaign -> 404", async () => {
    const res = await request(app)
      .post(`/api/campaigns/${MISSING}/properties`).set(auth).send({ name: "X", type: "NUMBER" });
    expect(res.status).toBe(404);
  });

  it("PATCH /api/properties/:id renames (200)", async () => {
    const res = await request(app)
      .patch(`/api/properties/${propertyIdByKey.get("clicks")}`).set(auth).send({ name: "TOTAL CLICKS" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("TOTAL CLICKS");
    await expectAudit({ action: "UPDATE", entityType: "property", entityId: propertyIdByKey.get("clicks")!, campaignId });
  });

  it("DELETE /api/properties/:id for a property used by a formula -> 409", async () => {
    const res = await request(app).delete(`/api/properties/${propertyIdByKey.get("spend")}`).set(auth);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain("CPC");
  });

  it("DELETE /api/properties/:id deletes an unused property (204)", async () => {
    const res = await request(app).delete(`/api/properties/${propertyIdByKey.get("comment")}`).set(auth);
    expect(res.status).toBe(204);
    await expectAudit({ action: "DELETE", entityType: "property", entityId: propertyIdByKey.get("comment")!, campaignId });
  });

  it("DELETE /api/properties/:id for a missing id -> 404", async () => {
    expect((await request(app).delete(`/api/properties/${MISSING}`).set(auth)).status).toBe(404);
  });

  it("POST /api/campaigns/:campaignId/properties on an unreachable campaign -> 404", async () => {
    const other = await signInAs("Other", { role: "MANAGER" });
    const stranger = await signInAs("Stranger", { role: "MANAGER" });
    const theirClient = await request(app).post("/api/clients").set(other.auth)
      .send({ name: "Theirs" });
    const theirProject = await request(app).post("/api/projects").set(other.auth)
      .send({ clientId: theirClient.body.id, name: "Theirs" });
    const theirCampaigns = await request(app)
      .get(`/api/projects/${theirProject.body.id}/campaigns`).set(other.auth);

    const res = await request(app)
      .post(`/api/campaigns/${theirCampaigns.body[0].id}/properties`).set(stranger.auth)
      .send({ name: "Spend", type: "MONEY" });
    expect(res.status).toBe(404);
  });

  it("DELETE /api/properties/:id for an unreachable property -> 404", async () => {
    const other = await signInAs("Other", { role: "MANAGER" });
    const stranger = await signInAs("Stranger", { role: "MANAGER" });
    const theirClient = await request(app).post("/api/clients").set(other.auth)
      .send({ name: "Theirs" });
    const theirProject = await request(app).post("/api/projects").set(other.auth)
      .send({ clientId: theirClient.body.id, name: "Theirs" });
    const theirCampaigns = await request(app)
      .get(`/api/projects/${theirProject.body.id}/campaigns`).set(other.auth);
    const theirTable = await request(app)
      .get(`/api/campaigns/${theirCampaigns.body[0].id}`).set(other.auth);

    const res = await request(app)
      .delete(`/api/properties/${theirTable.body.properties[0].id}`).set(stranger.auth);
    expect(res.status).toBe(404);
  });
});
