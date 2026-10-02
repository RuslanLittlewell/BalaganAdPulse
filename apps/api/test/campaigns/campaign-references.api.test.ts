import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { signInAs, signInAsOutsider } from "../helpers/auth.js";

const app = createApp();

let admin: { Authorization: string };
let projectId: string;

beforeEach(async () => {
  await resetDb();
  admin = (await signInAs("Admin", { role: "ADMIN" })).auth;
  ({ projectId } = await seedProject("", "Acme"));
});
afterAll(() => prisma.$disconnect());

describe("GET /api/projects/:projectId/campaigns/names", () => {
  it("lists a project's campaigns without figures or a range", async () => {
    const first = await seedCampaign(projectId, "Поиск / Москва", "YANDEX");
    const second = await seedCampaign(projectId, "Лента", "META");

    const res = await request(app).get(`/api/projects/${projectId}/campaigns/names`).set(admin);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: first.id, name: "Поиск / Москва", channel: "YANDEX" },
      { id: second.id, name: "Лента", channel: "META" },
    ]);
  });

  it("carries no measured figures", async () => {
    const campaign = await seedCampaign(projectId, "Поиск / Москва", "YANDEX");
    await prisma.campaignDailyMetric.create({
      data: {
        campaignId: campaign.id, date: new Date("2026-08-02T00:00:00.000Z"),
        spend: 1000, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50, revenue: 4000,
      },
    });

    const res = await request(app).get(`/api/projects/${projectId}/campaigns/names`).set(admin);

    expect(Object.keys(res.body[0]).sort()).toEqual(["channel", "id", "name"]);
  });

  it("answers an empty list for a project with no campaigns", async () => {
    const res = await request(app).get(`/api/projects/${projectId}/campaigns/names`).set(admin);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("404s a project the caller cannot reach", async () => {
    const outsider = await signInAsOutsider();
    const theirProject = await prisma.project.create({
      data: { clientId: outsider.client.id, name: "Их проект", position: 0 },
    });

    const res = await request(app).get(`/api/projects/${theirProject.id}/campaigns/names`).set(admin);

    expect(res.status).toBe(404);
  });

  it("requires authentication", async () => {
    expect((await request(app).get(`/api/projects/${projectId}/campaigns/names`)).status).toBe(401);
  });
});
