import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let clientId: string;

beforeEach(async () => {
  await resetDb();
  const client = await prisma.client.create({ data: { name: "Acme" } });
  clientId = client.id;
});
afterAll(async () => { await prisma.$disconnect(); });

describe("Campaigns API", () => {
  it("POST /api/clients/:clientId/campaigns creates (201)", async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/campaigns`).send({ name: "Facebook — July" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Facebook — July");
    expect(res.body.position).toBe(0);
  });

  it("POST with an empty name -> 400", async () => {
    const res = await request(app).post(`/api/clients/${clientId}/campaigns`).send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("POST for a missing client -> 404", async () => {
    const res = await request(app).post(`/api/clients/${MISSING}/campaigns`).send({ name: "A" });
    expect(res.status).toBe(404);
  });

  it("GET /api/clients/:clientId/campaigns lists (200)", async () => {
    await request(app).post(`/api/clients/${clientId}/campaigns`).send({ name: "A" });
    const res = await request(app).get(`/api/clients/${clientId}/campaigns`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("GET /api/campaigns/:id returns properties, records and totals (200)", async () => {
    const created = await request(app)
      .post(`/api/clients/${clientId}/campaigns`).send({ name: "A" });
    const res = await request(app).get(`/api/campaigns/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.properties).toHaveLength(11);
    expect(res.body.records).toEqual([]);
    expect(Object.keys(res.body.totals)).toHaveLength(11);
    expect(res.body.properties[0]).toMatchObject({ key: "spend", type: "MONEY", position: 0 });
  });

  it("GET /api/campaigns/:id for a missing id -> 404", async () => {
    expect((await request(app).get(`/api/campaigns/${MISSING}`)).status).toBe(404);
  });

  it("PATCH /api/campaigns/:id renames (200)", async () => {
    const created = await request(app)
      .post(`/api/clients/${clientId}/campaigns`).send({ name: "A" });
    const res = await request(app).patch(`/api/campaigns/${created.body.id}`).send({ name: "B" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("B");
  });

  it("DELETE /api/campaigns/:id deletes (204)", async () => {
    const created = await request(app)
      .post(`/api/clients/${clientId}/campaigns`).send({ name: "A" });
    expect((await request(app).delete(`/api/campaigns/${created.body.id}`)).status).toBe(204);
    expect(await prisma.campaign.count()).toBe(0);
  });
});
