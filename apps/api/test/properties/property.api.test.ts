import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import { createCampaign } from "../../src/campaigns/campaign.service.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let campaignId: string;
let propertyIdByKey: Map<string | null, string>;
let auth: { Authorization: string };

beforeEach(async () => {
  await resetDb();
  const signedIn = await signInAs();
  ({ auth } = signedIn);
  const client = await prisma.client.create({ data: { name: "Acme", ownerId: signedIn.user.id } });
  const campaign = await createCampaign(signedIn.user.id, client.id, { name: "A" });
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
  });

  it("DELETE /api/properties/:id for a property used by a formula -> 409", async () => {
    const res = await request(app).delete(`/api/properties/${propertyIdByKey.get("spend")}`).set(auth);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain("CPC");
  });

  it("DELETE /api/properties/:id deletes an unused property (204)", async () => {
    const res = await request(app).delete(`/api/properties/${propertyIdByKey.get("comment")}`).set(auth);
    expect(res.status).toBe(204);
  });

  it("DELETE /api/properties/:id for a missing id -> 404", async () => {
    expect((await request(app).delete(`/api/properties/${MISSING}`).set(auth)).status).toBe(404);
  });

  it("POST /api/campaigns/:campaignId/properties on another user's campaign -> 404", async () => {
    const other = await signInAs("Other");
    const theirClient = await request(app).post("/api/clients").set(other.auth)
      .send({ name: "Theirs" });
    const theirCampaigns = await request(app)
      .get(`/api/clients/${theirClient.body.id}/campaigns`).set(other.auth);

    const res = await request(app)
      .post(`/api/campaigns/${theirCampaigns.body[0].id}/properties`).set(auth)
      .send({ name: "Spend", type: "MONEY" });
    expect(res.status).toBe(404);
  });

  it("DELETE /api/properties/:id for another user's property -> 404", async () => {
    const other = await signInAs("Other");
    const theirClient = await request(app).post("/api/clients").set(other.auth)
      .send({ name: "Theirs" });
    const theirCampaigns = await request(app)
      .get(`/api/clients/${theirClient.body.id}/campaigns`).set(other.auth);
    const theirTable = await request(app)
      .get(`/api/campaigns/${theirCampaigns.body[0].id}`).set(other.auth);

    const res = await request(app)
      .delete(`/api/properties/${theirTable.body.properties[0].id}`).set(auth);
    expect(res.status).toBe(404);
  });
});
