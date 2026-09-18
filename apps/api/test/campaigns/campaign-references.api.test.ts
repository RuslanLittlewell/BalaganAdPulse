import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";

const app = createApp();

interface Reference {
  id: string;
  projectId: string;
  name: string;
  channel: string;
}

let admin: { Authorization: string };

beforeEach(async () => {
  await resetDb();
  admin = (await signInAs("Admin", { role: "ADMIN" })).auth;
});
afterAll(() => prisma.$disconnect());

const references = (auth: { Authorization: string }) =>
  request(app).get("/api/campaigns/names").set(auth);

describe("GET /api/campaigns/names", () => {
  it("returns every campaign of the organization for an admin", async () => {
    const acme = await seedProject("", "Acme");
    const globex = await seedProject("", "Globex");
    const first = await seedCampaign(acme.projectId, "Поиск / Москва", "YANDEX");
    const second = await seedCampaign(globex.projectId, "Лента", "META");

    const res = await references(admin);
    expect(res.status).toBe(200);
    expect(res.body.map((reference: Reference) => reference.id).sort())
      .toEqual([first.id, second.id].sort());
  });

  it("names the project each campaign belongs to", async () => {
    const { projectId } = await seedProject("", "Acme");
    const campaign = await seedCampaign(projectId, "Поиск / Москва", "YANDEX");

    const res = await references(admin);
    expect(res.body).toEqual([
      { id: campaign.id, projectId, name: "Поиск / Москва", channel: "YANDEX" },
    ]);
  });

  it("carries no measured figures", async () => {
    const { projectId } = await seedProject("", "Acme");
    const campaign = await seedCampaign(projectId, "Поиск / Москва", "YANDEX");
    await prisma.campaignDailyMetric.create({
      data: {
        campaignId: campaign.id, date: new Date("2026-08-02T00:00:00.000Z"),
        spend: 1000, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50, revenue: 4000,
      },
    });

    const res = await references(admin);
    expect(Object.keys(res.body[0]).sort()).toEqual(["channel", "id", "name", "projectId"]);
  });

  it("shows a manager only the campaigns their grants reach", async () => {
    const reachable = await seedProject("", "Acme");
    const ungranted = await seedProject("", "Globex");
    const mine = await seedCampaign(reachable.projectId, "Моя", "YANDEX");
    await seedCampaign(ungranted.projectId, "Чужая", "META");

    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, reachable.clientId);

    const res = await references(manager.auth);
    expect(res.body.map((reference: Reference) => reference.id)).toEqual([mine.id]);
  });

  it("answers an empty listing to a member who reaches nothing", async () => {
    const { projectId } = await seedProject("", "Acme");
    await seedCampaign(projectId, "Поиск / Москва", "YANDEX");
    const manager = await signInAs("Manager", { role: "MANAGER" });

    const res = await references(manager.auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("never crosses into another organization", async () => {
    const outsider = await signInAsOutsider();
    const project = await prisma.project.create({
      data: { clientId: outsider.client.id, name: "Их проект", position: 0 },
    });
    await prisma.campaign.create({
      data: { projectId: project.id, name: "Их", channel: "META", position: 0 },
    });

    expect((await references(admin)).body).toEqual([]);
  });

  it("refuses a request with no session -> 401", async () => {
    expect((await request(app).get("/api/campaigns/names")).status).toBe(401);
  });
});
