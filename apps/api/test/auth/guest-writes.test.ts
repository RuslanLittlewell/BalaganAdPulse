import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs } from "../helpers/auth.js";

const app = createApp();

/** A guest who *is* granted the client, so every refusal below is the role
 * talking and not the grant: an ungranted guest would answer 404 and prove
 * nothing about whether guests may write. */
let guest: { Authorization: string };
let clientId: string;
let projectId: string;
let campaignId: string;
let propertyId: string;
let recordId: string;

beforeEach(async () => {
  await resetDb();
  const admin = await signInAs("Admin", { role: "ADMIN" });
  ({ clientId, projectId } = await seedProject(admin.user.id));

  const campaign = await prisma.campaign.create({
    data: { projectId, name: "Main", position: 0 },
  });
  campaignId = campaign.id;
  const property = await prisma.campaignProperty.create({
    data: { campaignId, name: "SPEND", key: "spend", type: "MONEY", position: 0 },
  });
  propertyId = property.id;
  const record = await prisma.campaignRecord.create({
    data: { campaignId, date: new Date("2026-07-21") },
  });
  recordId = record.id;

  const signedIn = await signInAs("Guest", { role: "GUEST" });
  guest = signedIn.auth;
  await grantAccess(signedIn.membership!.id, clientId);
});
afterAll(async () => { await prisma.$disconnect(); });

describe("a guest reads everything they are granted", () => {
  it("lists and reads the client", async () => {
    expect((await request(app).get("/api/clients").set(guest)).body.length).toBe(1);
    expect((await request(app).get(`/api/clients/${clientId}`).set(guest)).status).toBe(200);
  });

  it("reads the project and its campaign table", async () => {
    expect((await request(app).get(`/api/projects/${projectId}`).set(guest)).status).toBe(200);
    expect((await request(app).get(`/api/campaigns/${campaignId}`).set(guest)).status).toBe(200);
  });
});

describe("a guest is refused every write", () => {
  const refused = (name: string, send: () => request.Test) => {
    it(name, async () => {
      const res = await send();
      expect(res.status).toBe(403);
    });
  };

  refused("creating a client", () =>
    request(app).post("/api/clients").set(guest).send({ name: "New" }));
  refused("editing a client", () =>
    request(app).patch(`/api/clients/${clientId}`).set(guest).send({ name: "Renamed" }));
  refused("deleting a client", () =>
    request(app).delete(`/api/clients/${clientId}`).set(guest));

  refused("creating a project", () =>
    request(app).post("/api/projects").set(guest).send({ clientId, name: "New" }));
  refused("editing a project", () =>
    request(app).patch(`/api/projects/${projectId}`).set(guest).send({ name: "Renamed" }));
  refused("deleting a project", () =>
    request(app).delete(`/api/projects/${projectId}`).set(guest));

  refused("creating a campaign", () =>
    request(app).post(`/api/projects/${projectId}/campaigns`).set(guest).send({ name: "New" }));
  refused("renaming a campaign", () =>
    request(app).patch(`/api/campaigns/${campaignId}`).set(guest).send({ name: "Renamed" }));
  refused("deleting a campaign", () =>
    request(app).delete(`/api/campaigns/${campaignId}`).set(guest));

  refused("creating a column", () =>
    request(app).post(`/api/campaigns/${campaignId}/properties`).set(guest)
      .send({ name: "CLICKS", type: "NUMBER" }));
  refused("editing a column", () =>
    request(app).patch(`/api/properties/${propertyId}`).set(guest).send({ name: "COST" }));
  refused("deleting a column", () =>
    request(app).delete(`/api/properties/${propertyId}`).set(guest));

  refused("adding a day", () =>
    request(app).post(`/api/campaigns/${campaignId}/records`).set(guest)
      .send({ date: "2026-07-22" }));
  refused("deleting a day", () =>
    request(app).delete(`/api/records/${recordId}`).set(guest));

  refused("writing a cell value", () =>
    request(app).put(`/api/records/${recordId}/values/${propertyId}`).set(guest)
      .send({ value: "10.0000" }));

  it("stores nothing when a cell write is refused", async () => {
    await request(app).put(`/api/records/${recordId}/values/${propertyId}`).set(guest)
      .send({ value: "10.0000" });
    expect(await prisma.campaignPropertyValue.count()).toBe(0);
  });

  it("leaves the client standing after a refused delete", async () => {
    await request(app).delete(`/api/clients/${clientId}`).set(guest);
    expect(await prisma.client.findUnique({ where: { id: clientId } })).not.toBeNull();
  });
});
