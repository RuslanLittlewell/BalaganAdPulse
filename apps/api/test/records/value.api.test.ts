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
let recordId: string;
let propertyIdByKey: Map<string | null, string>;
let auth: { Authorization: string };
let actor: Actor;
let ownerId: string;

beforeEach(async () => {
  await resetDb();
  const signedIn = await signInAs();
  ({ auth } = signedIn);
  actor = signedIn.actor!;
  ownerId = signedIn.user.id;
  const { projectId } = await seedProject(ownerId);
  campaignId = (await seedCampaign(projectId, "A")).id;
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
  it("writes several cells as one row event with before and after values", async () => {
    await setValue("spend", "100");

    const response = await request(app)
      .put(`/api/records/${recordId}/values`)
      .set(auth)
      .send({
        values: [
          { propertyId: propertyIdByKey.get("spend"), value: "125" },
          { propertyId: propertyIdByKey.get("leads"), value: "3" },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.record.values[propertyIdByKey.get("spend")!]).toBe("125.0000");
    expect(response.body.record.values[propertyIdByKey.get("leads")!]).toBe("3.0000");

    const events = await prisma.auditEvent.findMany({
      where: { action: "UPDATE", entityType: "record", entityId: recordId },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.changes).toEqual([
      { field: "SPEND", before: "100.0000", after: "125.0000" },
      { field: "LEADS", before: null, after: "3.0000" },
    ]);
  });

  it("writes a numeric value and recomputes the record (200)", async () => {
    await setValue("impressions", "1000");
    const res = await setValue("clicks", "25");
    expect(res.status).toBe(200);
    expect(res.body.record.values[propertyIdByKey.get("clicks")!]).toBe("25.0000");
    expect(res.body.record.values[propertyIdByKey.get("ctr")!]).toBe("2.5000");
    expect(res.body.totals[propertyIdByKey.get("ctr")!]).toBe("2.5000");
    await expectAudit({
      action: "UPDATE",
      entityType: "value",
      entityId: `${recordId}:${propertyIdByKey.get("clicks")!}`,
      campaignId,
    });
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
    const { projectId: otherProjectId } = await seedProject(ownerId, "Other");
    const other = await seedCampaign(otherProjectId, "B");
    const foreign = await prisma.campaignProperty.findFirstOrThrow({
      where: { campaignId: other.id, key: "clicks" },
    });
    const res = await request(app)
      .put(`/api/records/${recordId}/values/${foreign.id}`).set(auth).send({ value: "1" });
    expect(res.status).toBe(404);
  });

  it("PUT /api/records/:recordId/values/:propertyId on an unreachable row -> 404", async () => {
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
    const theirRecord = await request(app)
      .post(`/api/campaigns/${theirCampaigns.body[0].id}/records`).set(other.auth)
      .send({ date: "2026-08-13" });
    const entered = theirTable.body.properties.find(
      (property: { formula: unknown }) => property.formula === null,
    );

    const res = await request(app)
      .put(`/api/records/${theirRecord.body.id}/values/${entered.id}`).set(stranger.auth)
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
  it("hides a record the caller holds no grant for behind the same 404", async () => {
    const other = await signInAs("Other", { role: "MANAGER" });
    const res = await request(app)
      .put(`/api/records/${recordId}/values/${propertyIdByKey.get("clicks")!}`)
      .set(other.auth).send({ value: "1" });
    expect(res.status).toBe(404);
  });
});
