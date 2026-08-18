import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import { createCampaign } from "../../src/campaigns/campaign.service.js";
import { deleteRecord } from "../../src/records/record.service.js";
import { NotFoundError } from "../../src/errors.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let campaignId: string;
let auth: { Authorization: string };

beforeEach(async () => {
  await resetDb();
  const signedIn = await signInAs();
  ({ auth } = signedIn);
  const client = await prisma.client.create({ data: { name: "Acme", ownerId: signedIn.user.id } });
  campaignId = (await createCampaign(signedIn.user.id, client.id, { name: "A" })).id;
});
afterAll(async () => { await prisma.$disconnect(); });

function addDay(date: string) {
  return request(app).post(`/api/campaigns/${campaignId}/records`).set(auth).send({ date });
}

describe("Records API", () => {
  it("POST /api/campaigns/:campaignId/records creates a day (201)", async () => {
    const res = await addDay("2026-07-21");
    expect(res.status).toBe(201);
    expect(res.body.date).toBe("2026-07-21");
  });

  it("POST with a duplicate date -> 409", async () => {
    await addDay("2026-07-21");
    const res = await addDay("2026-07-21");
    expect(res.status).toBe(409);
  });

  it("POST with a malformed date -> 400", async () => {
    const res = await addDay("21.07.2026");
    expect(res.status).toBe(400);
  });

  it("POST for a missing campaign -> 404", async () => {
    const res = await request(app)
      .post(`/api/campaigns/${MISSING}/records`).set(auth).send({ date: "2026-07-21" });
    expect(res.status).toBe(404);
  });

  it("PATCH /api/records/:id moves the day (200)", async () => {
    const created = await addDay("2026-07-21");
    const res = await request(app).patch(`/api/records/${created.body.id}`).set(auth).send({ date: "2026-07-22" });
    expect(res.status).toBe(200);
    expect(res.body.date).toBe("2026-07-22");
  });

  it("PATCH onto an occupied date -> 409", async () => {
    const created = await addDay("2026-07-21");
    await addDay("2026-07-22");
    const res = await request(app).patch(`/api/records/${created.body.id}`).set(auth).send({ date: "2026-07-22" });
    expect(res.status).toBe(409);
  });

  it("DELETE /api/records/:id deletes the day and its values (204)", async () => {
    const created = await addDay("2026-07-21");
    const property = await prisma.campaignProperty.findFirstOrThrow({
      where: { campaignId, key: "clicks" },
    });
    await prisma.campaignPropertyValue.create({
      data: { recordId: created.body.id, propertyId: property.id, numberValue: "10" },
    });
    expect((await request(app).delete(`/api/records/${created.body.id}`).set(auth)).status).toBe(204);
    expect(await prisma.campaignPropertyValue.count()).toBe(0);
  });

  it("DELETE /api/records/:id for a missing id -> 404", async () => {
    expect((await request(app).delete(`/api/records/${MISSING}`).set(auth)).status).toBe(404);
  });

  it("returns records in the campaign payload ordered by date", async () => {
    await addDay("2026-07-22");
    await addDay("2026-07-21");
    const res = await request(app).get(`/api/campaigns/${campaignId}`).set(auth);
    expect(res.body.records.map((record: { date: string }) => record.date))
      .toEqual(["2026-07-21", "2026-07-22"]);
  });

  it("POST /api/campaigns/:campaignId/records on another user's campaign -> 404", async () => {
    const other = await signInAs("Other");
    const theirClient = await request(app).post("/api/clients").set(other.auth)
      .send({ name: "Theirs" });
    const theirCampaigns = await request(app)
      .get(`/api/clients/${theirClient.body.id}/campaigns`).set(other.auth);

    const res = await request(app)
      .post(`/api/campaigns/${theirCampaigns.body[0].id}/records`).set(auth)
      .send({ date: "2026-08-13" });
    expect(res.status).toBe(404);
  });

  it("DELETE /api/records/:id for another user's record -> 404 and keeps it", async () => {
    const other = await signInAs("Other");
    const theirClient = await request(app).post("/api/clients").set(other.auth)
      .send({ name: "Theirs" });
    const theirCampaigns = await request(app)
      .get(`/api/clients/${theirClient.body.id}/campaigns`).set(other.auth);
    const theirRecord = await request(app)
      .post(`/api/campaigns/${theirCampaigns.body[0].id}/records`).set(other.auth)
      .send({ date: "2026-08-13" });

    const res = await request(app).delete(`/api/records/${theirRecord.body.id}`).set(auth);
    expect(res.status).toBe(404);
    expect(await prisma.campaignRecord.count()).toBe(1);
  });

  // The service, not the route: the ownership filter lives here, and an HTTP
  // test alone would stay green if it were moved somewhere else.
  it("record.service hides another owner's record behind NotFoundError", async () => {
    const created = await addDay("2026-07-21");
    const { user: other } = await signInAs("Other");
    await expect(deleteRecord(other.id, created.body.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
