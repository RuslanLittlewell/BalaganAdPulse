import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import { createCampaign } from "../../src/campaigns/campaign.service.js";
import { setPropertyValue } from "../../src/records/value.service.js";
import { NotFoundError } from "../../src/errors.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let campaignId: string;
let recordId: string;
let propertyIdByKey: Map<string | null, string>;
let auth: { Authorization: string };
let ownerId: string;

beforeEach(async () => {
  await resetDb();
  const signedIn = await signInAs();
  ({ auth } = signedIn);
  ownerId = signedIn.user.id;
  const client = await prisma.client.create({ data: { name: "Acme", ownerId } });
  campaignId = (await createCampaign(ownerId, client.id, { name: "A" })).id;
  const properties = await prisma.campaignProperty.findMany({ where: { campaignId } });
  propertyIdByKey = new Map(properties.map((property) => [property.key, property.id]));
  const record = await request(app)
    .post(`/api/campaigns/${campaignId}/records`).set(auth).send({ date: "2026-07-21" });
  recordId = record.body.id;
});
afterAll(async () => { await prisma.$disconnect(); });

function setValue(propertyKey: string, value: unknown, targetRecordId = recordId) {
  return request(app)
    .put(`/api/records/${targetRecordId}/values/${propertyIdByKey.get(propertyKey)}`)
    .set(auth)
    .send({ value });
}

describe("Property values API", () => {
  it("writes a numeric value and recomputes the record (200)", async () => {
    await setValue("impressions", "1000");
    const res = await setValue("clicks", "25");
    expect(res.status).toBe(200);
    expect(res.body.record.values[propertyIdByKey.get("clicks")!]).toBe("25.0000");
    expect(res.body.record.values[propertyIdByKey.get("ctr")!]).toBe("2.5000");
    expect(res.body.totals[propertyIdByKey.get("ctr")!]).toBe("2.5000");
  });

  it("round-trips a fractional value at full precision", async () => {
    await setValue("spend", "1234.5678");
    const res = await request(app).get(`/api/campaigns/${campaignId}`).set(auth);
    const record = res.body.records.find((candidate: { id: string }) => candidate.id === recordId);
    expect(record.values[propertyIdByKey.get("spend")!]).toBe("1234.5678");
  });

  it("is idempotent: repeating the same write keeps one stored value", async () => {
    await setValue("clicks", "25");
    await setValue("clicks", "25");
    expect(await prisma.campaignPropertyValue.count()).toBe(1);
  });

  it("writes a text value", async () => {
    const res = await setValue("comment", "good day");
    expect(res.body.record.values[propertyIdByKey.get("comment")!]).toBe("good day");
  });

  it("clears a value with null", async () => {
    await setValue("clicks", "25");
    const res = await setValue("clicks", null);
    expect(res.body.record.values[propertyIdByKey.get("clicks")!]).toBeNull();
    expect(await prisma.campaignPropertyValue.count()).toBe(0);
  });

  it("rejects a write to a computed property -> 400", async () => {
    const res = await setValue("ctr", "5");
    expect(res.status).toBe(400);
  });

  it("rejects text in a numeric property -> 400", async () => {
    const res = await setValue("clicks", "many");
    expect(res.status).toBe(400);
  });

  it("rejects a number in a text property -> 400", async () => {
    const res = await setValue("comment", 5);
    expect(res.status).toBe(400);
  });

  it("rejects a JSON number as a value -> 400", async () => {
    const res = await setValue("clicks", 25);
    expect(res.status).toBe(400);
  });

  it("returns 404 for a missing record", async () => {
    const res = await setValue("clicks", "1", MISSING);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a property of another campaign", async () => {
    const client = await prisma.client.create({ data: { name: "Other", ownerId } });
    const other = await createCampaign(ownerId, client.id, { name: "B" });
    const foreign = await prisma.campaignProperty.findFirstOrThrow({
      where: { campaignId: other.id, key: "clicks" },
    });
    const res = await request(app)
      .put(`/api/records/${recordId}/values/${foreign.id}`).set(auth).send({ value: "1" });
    expect(res.status).toBe(404);
  });

  it("PUT /api/records/:recordId/values/:propertyId on another user's row -> 404", async () => {
    const other = await signInAs("Other");
    const theirClient = await request(app).post("/api/clients").set(other.auth)
      .send({ name: "Theirs" });
    const theirCampaigns = await request(app)
      .get(`/api/clients/${theirClient.body.id}/campaigns`).set(other.auth);
    const theirTable = await request(app)
      .get(`/api/campaigns/${theirCampaigns.body[0].id}`).set(other.auth);
    const theirRecord = await request(app)
      .post(`/api/campaigns/${theirCampaigns.body[0].id}/records`).set(other.auth)
      .send({ date: "2026-08-13" });
    const entered = theirTable.body.properties.find(
      (property: { formula: unknown }) => property.formula === null,
    );

    const res = await request(app)
      .put(`/api/records/${theirRecord.body.id}/values/${entered.id}`).set(auth)
      .send({ value: "100" });

    expect(res.status).toBe(404);
    // The pre-fix code answered 404 too — from a downstream campaign check, after
    // it had already written the value. Only the absence of the row proves the
    // request was stopped rather than merely reported as failed.
    expect(await prisma.campaignPropertyValue.count({
      where: { recordId: theirRecord.body.id, propertyId: entered.id },
    })).toBe(0);
  });

  // The service, not the route: the ownership filter lives here, and an HTTP
  // test alone would stay green if it were moved somewhere else.
  it("value.service hides another owner's record behind NotFoundError", async () => {
    const { user: other } = await signInAs("Other");
    await expect(
      setPropertyValue(other.id, recordId, propertyIdByKey.get("clicks")!, "1"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
