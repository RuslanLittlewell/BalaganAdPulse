import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import { createCampaign } from "../../src/campaigns/campaign.service.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let campaignId: string;
let propertyIdByKey: Map<string | null, string>;

beforeEach(async () => {
  await resetDb();
  const client = await prisma.client.create({ data: { name: "Acme" } });
  const campaign = await createCampaign(client.id, { name: "A" });
  campaignId = campaign.id;
  const properties = await prisma.campaignProperty.findMany({ where: { campaignId } });
  propertyIdByKey = new Map(properties.map((property) => [property.key, property.id]));
});
afterAll(async () => { await prisma.$disconnect(); });

describe("Properties API", () => {
  it("POST /api/campaigns/:campaignId/properties creates (201)", async () => {
    const res = await request(app)
      .post(`/api/campaigns/${campaignId}/properties`).send({ name: "FREQUENCY", type: "NUMBER" });
    expect(res.status).toBe(201);
    expect(res.body.position).toBe(11);
  });

  it("POST with an unknown type -> 400", async () => {
    const res = await request(app)
      .post(`/api/campaigns/${campaignId}/properties`).send({ name: "X", type: "DATE" });
    expect(res.status).toBe(400);
  });

  it("POST with a malformed formula -> 400", async () => {
    const res = await request(app).post(`/api/campaigns/${campaignId}/properties`)
      .send({ name: "X", type: "NUMBER", formula: { kind: "binary", op: "%" } });
    expect(res.status).toBe(400);
  });

  it("POST for a missing campaign -> 404", async () => {
    const res = await request(app)
      .post(`/api/campaigns/${MISSING}/properties`).send({ name: "X", type: "NUMBER" });
    expect(res.status).toBe(404);
  });

  it("PATCH /api/properties/:id renames (200)", async () => {
    const res = await request(app)
      .patch(`/api/properties/${propertyIdByKey.get("clicks")}`).send({ name: "TOTAL CLICKS" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("TOTAL CLICKS");
  });

  it("DELETE /api/properties/:id for a property used by a formula -> 409", async () => {
    const res = await request(app).delete(`/api/properties/${propertyIdByKey.get("spend")}`);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain("CPC");
  });

  it("DELETE /api/properties/:id deletes an unused property (204)", async () => {
    const res = await request(app).delete(`/api/properties/${propertyIdByKey.get("comment")}`);
    expect(res.status).toBe(204);
  });

  it("DELETE /api/properties/:id for a missing id -> 404", async () => {
    expect((await request(app).delete(`/api/properties/${MISSING}`)).status).toBe(404);
  });
});
