import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();
let auth: { Authorization: string };

beforeEach(async () => {
  await resetDb();
  ({ auth } = await signInAs("Summary Actor"));
});
afterAll(async () => { await prisma.$disconnect(); });

describe("stored audit summaries", () => {
  it("stores a readable entity summary at write time", async () => {
    const client = await request(app).post("/api/clients").set(auth).send({ name: "Acme" });
    const event = await prisma.auditEvent.findFirstOrThrow({
      where: { entityType: "client", entityId: client.body.id, action: "CREATE" },
    });

    expect(event.summary).toBe('Created client “Acme”');
  });

  it("keeps the column name used by a value event after the column is renamed", async () => {
    const client = await request(app).post("/api/clients").set(auth).send({ name: "Acme" });
    const project = await request(app).post("/api/projects").set(auth)
      .send({ clientId: client.body.id, name: "Launch" });
    const campaigns = await request(app).get(`/api/projects/${project.body.id}/campaigns`).set(auth);
    const campaignId = campaigns.body[0].id as string;
    const table = await request(app).get(`/api/campaigns/${campaignId}`).set(auth);
    const spend = table.body.properties.find((property: { key: string }) => property.key === "spend");
    const row = await request(app).post(`/api/campaigns/${campaignId}/records`).set(auth)
      .send({ date: "2026-08-31" });

    await request(app).put(`/api/records/${row.body.id}/values/${spend.id}`).set(auth)
      .send({ value: "125.50" });
    const original = await prisma.auditEvent.findFirstOrThrow({
      where: { entityType: "value", entityId: `${row.body.id}:${spend.id}` },
    });
    expect(original.summary).toBe('Updated column “SPEND” on row 2026-08-31');

    await request(app).patch(`/api/properties/${spend.id}`).set(auth)
      .send({ name: "MEDIA SPEND" });
    const stored = await prisma.auditEvent.findUniqueOrThrow({ where: { id: original.id } });
    expect(stored.summary).toBe('Updated column “SPEND” on row 2026-08-31');
  });
});
