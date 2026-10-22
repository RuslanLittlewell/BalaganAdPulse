import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();
const RANGE = "?from=2026-08-01&to=2026-08-03";
const DAY = new Date("2026-08-02T00:00:00.000Z");

let auth: { Authorization: string };
let projectId: string;

beforeEach(async () => {
  await resetDb();
  const admin = await signInAs();
  auth = admin.auth;
  ({ projectId } = await seedProject(admin.user.id));
});
afterAll(async () => { await prisma.$disconnect(); });

async function adSetOf(campaignId: string, name: string, optimizationGoal: string | null, results: number, position = 0) {
  const adSet = await prisma.adSet.create({ data: { campaignId, name, optimizationGoal, position } });
  await prisma.adSetDailyMetric.create({ data: { adSetId: adSet.id, date: DAY, results } });
  return adSet;
}

const campaignOf = async (id: string) =>
  (await request(app).get(`/api/campaigns/${id}${RANGE}`).set(auth)).body;

describe("the result types of a campaign", () => {
  it("lists the results of each kind its ad sets produced", async () => {
    const campaign = await seedCampaign(projectId, "Смешанная", "META");
    await adSetOf(campaign.id, "Сообщения", "CONVERSATIONS", 120);
    await adSetOf(campaign.id, "Профиль", "PROFILE_VISIT", 45, 1);
    await prisma.campaignDailyMetric.create({ data: { campaignId: campaign.id, date: DAY, results: 165 } });

    const body = await campaignOf(campaign.id);

    expect(body.performance.results).toBe(165);
    expect(body.resultTypes).toEqual([
      { type: "MESSAGES", results: 120 },
      { type: "PROFILE_VISITS", results: 45 },
    ]);
  });

  it("counts only the days of the range", async () => {
    const campaign = await seedCampaign(projectId, "Сообщения", "META");
    const adSet = await adSetOf(campaign.id, "Группа", "CONVERSATIONS", 10);
    await prisma.adSetDailyMetric.create({ data: { adSetId: adSet.id, date: new Date("2026-07-01T00:00:00.000Z"), results: 500 } });

    expect((await campaignOf(campaign.id)).resultTypes).toEqual([{ type: "MESSAGES", results: 10 }]);
  });

  it("calls the results of a Google campaign conversions", async () => {
    const campaign = await seedCampaign(projectId, "Поиск", "GOOGLE");
    await prisma.campaignDailyMetric.create({ data: { campaignId: campaign.id, date: DAY, conversions: 9, results: 9 } });

    expect((await campaignOf(campaign.id)).resultTypes).toEqual([{ type: "CONVERSIONS", results: 9 }]);
  });

  it("files results under unknown while no goal was imported", async () => {
    const campaign = await seedCampaign(projectId, "Старая", "META");
    await adSetOf(campaign.id, "Группа", null, 30);

    expect((await campaignOf(campaign.id)).resultTypes).toEqual([{ type: "UNKNOWN", results: 30 }]);
  });

  it("is empty for a campaign with nothing to count", async () => {
    const campaign = await seedCampaign(projectId, "Пустая", "META");
    expect((await campaignOf(campaign.id)).resultTypes).toEqual([]);
  });

  it("comes with each campaign of a project's list", async () => {
    const campaign = await seedCampaign(projectId, "Сообщения", "META");
    await adSetOf(campaign.id, "Группа", "CONVERSATIONS", 4);

    const res = await request(app).get(`/api/projects/${projectId}/campaigns${RANGE}`).set(auth);

    expect(res.body[0].resultTypes).toEqual([{ type: "MESSAGES", results: 4 }]);
  });
});

describe("the result type of an ad set and its ads", () => {
  it("is the ad set's, and its ads take it", async () => {
    const campaign = await seedCampaign(projectId, "Профиль", "META");
    const adSet = await adSetOf(campaign.id, "Группа", "PROFILE_VISIT", 3);
    await prisma.ad.create({ data: { adSetId: adSet.id, name: "Объявление", position: 0 } });

    const sets = await request(app).get(`/api/campaigns/${campaign.id}/ad-sets${RANGE}`).set(auth);
    const ads = await request(app).get(`/api/ad-sets/${adSet.id}/ads${RANGE}`).set(auth);

    expect(sets.body[0].resultType).toBe("PROFILE_VISITS");
    expect(sets.body[0]).not.toHaveProperty("optimizationGoal");
    expect(ads.body[0].resultType).toBe("PROFILE_VISITS");
  });
});
