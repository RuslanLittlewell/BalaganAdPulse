import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";

const app = createApp();
const RANGE = "?from=2026-08-01&to=2026-08-03";
const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

let auth: { Authorization: string };
let clinic: { clientId: string; projectId: string };
let dealer: { clientId: string; projectId: string };

const record = (campaignId: string, iso: string, figures: Record<string, number>) =>
  prisma.campaignDailyMetric.create({ data: { campaignId, date: date(iso), ...figures } });

beforeEach(async () => {
  await resetDb();
  const admin = await signInAs();
  auth = admin.auth;
  clinic = await seedProject(admin.user.id, "Клиника");
  dealer = await seedProject(admin.user.id, "Автосалон");
  const search = await seedCampaign(clinic.projectId, "Поиск", "YANDEX");
  const feed = await seedCampaign(clinic.projectId, "Лента", "META");
  await record(search.id, "2026-08-01", { spend: 400, clicks: 100 });
  await record(search.id, "2026-08-02", { spend: 600, clicks: 100 });
  await record(feed.id, "2026-08-02", { spend: 100, clicks: 20 });
  await record(feed.id, "2026-09-01", { spend: 9999 });
});
afterAll(async () => { await prisma.$disconnect(); });

const read = (headers: { Authorization: string }, range = RANGE) =>
  request(app).get(`/api/summary/projects${range}`).set(headers);

describe("GET /api/summary/projects", () => {
  it("returns every project's totals and days in one response", async () => {
    const res = await read(auth);

    expect(res.status).toBe(200);
    const clinicFigures = res.body.find((entry: { projectId: string }) => entry.projectId === clinic.projectId);
    expect(clinicFigures.performance).toMatchObject({ spend: 1100, clicks: 220, cpc: 5 });
    expect(clinicFigures.days).toEqual([
      expect.objectContaining({ date: "2026-08-01", spend: 400 }),
      expect.objectContaining({ date: "2026-08-02", spend: 700 }),
    ]);
    expect(clinicFigures.days[0]).not.toHaveProperty("campaignId");
  });

  it("lists a project with nothing measured at zero, with no days", async () => {
    const res = await read(auth);

    expect(res.body).toHaveLength(2);
    expect(res.body).toContainEqual({
      projectId: dealer.projectId,
      kpi: null,
      performance: expect.objectContaining({ spend: 0, cpc: null }),
      days: [],
    });
  });

  it("carries each project's own KPI beside its figures", async () => {
    await request(app).put(`/api/projects/${clinic.projectId}/kpi`).set(auth).send({ metric: "CONVERSIONS", target: "60" });

    const res = await read(auth);

    const clinicFigures = res.body.find((entry: { projectId: string }) => entry.projectId === clinic.projectId);
    expect(clinicFigures.kpi).toEqual({ metric: "CONVERSIONS", target: "60.0000" });
  });

  it("carries the name and value of a KPI set by hand", async () => {
    await request(app).put(`/api/projects/${clinic.projectId}/kpi`).set(auth)
      .send({ metric: "MANUAL", name: "Продажи", value: "30", target: "50" });

    const res = await read(auth);

    const clinicFigures = res.body.find((entry: { projectId: string }) => entry.projectId === clinic.projectId);
    expect(clinicFigures.kpi).toEqual({ metric: "MANUAL", name: "Продажи", value: "30.0000", target: "50.0000" });
  });

  it("never lets a campaign's KPI stand in for its project's", async () => {
    const campaign = await seedCampaign(dealer.projectId, "Поиск", "YANDEX");
    await request(app).put(`/api/campaigns/${campaign.id}/kpi`).set(auth).send({ metric: "CPA", target: "10" });

    const res = await read(auth);

    const dealerFigures = res.body.find((entry: { projectId: string }) => entry.projectId === dealer.projectId);
    expect(dealerFigures.kpi).toBeNull();
  });

  it("counts only the days inside the range", async () => {
    const res = await read(auth, "?from=2026-08-02&to=2026-09-01");

    const clinicFigures = res.body.find((entry: { projectId: string }) => entry.projectId === clinic.projectId);
    expect(clinicFigures.performance.spend).toBe(600 + 100 + 9999);
    expect(clinicFigures.days.map((entry: { date: string }) => entry.date)).toEqual(["2026-08-02", "2026-09-01"]);
  });

  it("lists only the project a member holds a grant over", async () => {
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clinic.clientId, clinic.projectId);

    const res = await read(manager.auth);

    expect(res.status).toBe(200);
    expect(res.body.map((entry: { projectId: string }) => entry.projectId)).toEqual([clinic.projectId]);
  });

  it("never lists another organization's project", async () => {
    const outsider = await signInAsOutsider();
    const theirs = await prisma.project.create({
      data: { clientId: outsider.client.id, name: "Их проект", position: 0 },
    });

    const res = await read(auth);

    expect(res.body.map((entry: { projectId: string }) => entry.projectId)).not.toContain(theirs.id);
  });

  it("refuses a range that ends before it starts", async () => {
    expect((await read(auth, "?from=2026-08-03&to=2026-08-01")).status).toBe(400);
  });

  it("refuses a request without a range", async () => {
    expect((await read(auth, "")).status).toBe(400);
  });

  it("asks who is reading", async () => {
    expect((await request(app).get(`/api/summary/projects${RANGE}`)).status).toBe(401);
  });
});
