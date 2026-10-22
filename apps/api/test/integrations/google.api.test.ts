import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject, seedCampaign } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-4000-8000-000000000000";
let auth: { Authorization: string };
let projectId: string;
let integrationId: string;
const base = () => `/api/projects/${projectId}/integrations`;

beforeEach(async () => {
  await resetDb();
  const member = await signInAs();
  ({ auth } = member);
  ({ projectId } = await seedProject(member.user.id));
  const row = await prisma.projectIntegration.create({
    data: { projectId, provider: "GOOGLE", accountId: "222", loginCustomerId: "111", currency: "USD", timezone: "UTC", encryptedToken: "sealed-credential", revision: "v1", status: "AUTH_REQUIRED", lastError: "TOKEN", nextDailyAt: new Date() },
  });
  integrationId = row.id;
});
afterAll(() => prisma.$disconnect());

describe("Google connections over HTTP", () => {
  it("are listed with their provider and never with the credential", async () => {
    const res = await request(app).get(base()).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ id: integrationId, provider: "GOOGLE", accountId: "222", status: "AUTH_REQUIRED" })]);
    expect(JSON.stringify(res.body)).not.toContain("sealed-credential");
    expect(JSON.stringify(res.body)).not.toContain("loginCustomerId");
  });

  it("report that Google is not configured when the server has no Google client", async () => {
    const res = await request(app).post(`${base()}/google/authorize`).set(auth).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ code: "CONFIGURATION" }]);
  });

  it("need a session to start, to list accounts and to connect", async () => {
    expect((await request(app).post(`${base()}/google/authorize`).send({})).status).toBe(401);
    expect((await request(app).get(`${base()}/google/accounts?authorization=${MISSING}`)).status).toBe(401);
    expect((await request(app).post(`${base()}/google`).send({ authorization: MISSING })).status).toBe(401);
  });

  it("refuse a body that names no sign-in", async () => {
    expect((await request(app).post(`${base()}/google`).set(auth).send({ accountId: "222" })).status).toBe(400);
    expect((await request(app).get(`${base()}/google/accounts`).set(auth)).status).toBe(400);
  });

  it("do not take a pasted token in place of signing in", async () => {
    const res = await request(app).put(`${base()}/${integrationId}`).set(auth).send({ accountId: "222", token: "pasted" });
    expect(res.status).toBe(400);
    expect((await prisma.projectIntegration.findUniqueOrThrow({ where: { id: integrationId } })).encryptedToken).toBe("sealed-credential");
  });

  it("do not take a lead import switch", async () => {
    const res = await request(app).patch(`${base()}/${integrationId}`).set(auth).send({ leadsEnabled: true });
    expect(res.status).toBe(400);
    expect((await prisma.projectIntegration.findUniqueOrThrow({ where: { id: integrationId } })).leadsEnabled).toBe(false);
  });

  it("can be refreshed by hand like any other", async () => {
    const res = await request(app).post(`${base()}/${integrationId}/sync`).set(auth);
    expect(res.status).toBe(202);
  });

  it("can be disconnected, leaving what was imported", async () => {
    const campaign = await seedCampaign(projectId, "Imported", "GOOGLE");

    const res = await request(app).delete(`${base()}/${integrationId}`).set(auth);

    expect(res.status).toBe(204);
    expect(await prisma.projectIntegration.count()).toBe(0);
    expect(await prisma.campaign.findUnique({ where: { id: campaign.id } })).not.toBeNull();
    const audited = JSON.stringify(await prisma.auditEvent.findMany());
    expect(audited).toContain("Disconnected Google Ads account");
  });

  it("have no rendered ad preview, and no creatives to read while Google Ads is not configured", async () => {
    const campaign = await seedCampaign(projectId, "G", "GOOGLE");
    await prisma.campaign.update({ where: { id: campaign.id }, data: { sourceAccountId: "222" } });
    const adSet = await prisma.adSet.create({ data: { campaignId: campaign.id, name: "Group", position: 0, externalId: "9002" } });
    const ad = await prisma.ad.create({ data: { adSetId: adSet.id, name: "Ad", externalId: "9003", position: 0 } });

    expect((await request(app).get(`/api/ads/${ad.id}/preview`).set(auth)).status).toBe(404);
    expect((await request(app).get(`/api/ads/${ad.id}/creatives`).set(auth)).body).toEqual([]);
  });
});

describe("the page Google sends the browser back to", () => {
  it("needs no session, since it is Google's redirect, and sends a stranger to the project list as failed", async () => {
    const res = await request(app).get("/api/integrations/google/callback?state=forged&code=abc");
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\/projects\?google=failed$/);
  });

  it("sends a refusal at Google back to the project that asked as failed", async () => {
    const opened = await prisma.googleAuthorization.create({
      data: { projectId, userId: "u", expiresAt: new Date(Date.now() + 60_000) },
    });

    const res = await request(app).get(`/api/integrations/google/callback?state=${opened.id}&error=access_denied`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(new RegExp(`/projects/${projectId}\\?google=failed$`));
    expect(await prisma.googleAuthorization.findUnique({ where: { id: opened.id } })).toBeNull();
  });

  it("does not leak the code into where it sends the browser", async () => {
    const res = await request(app).get("/api/integrations/google/callback?state=forged&code=secret-code");
    expect(res.headers.location).not.toContain("secret-code");
  });
});
