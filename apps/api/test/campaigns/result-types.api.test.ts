import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();
const RANGE = "?from=2026-08-01&to=2026-08-03";
const DAY = new Date("2026-08-02T00:00:00.000Z");
const NEXT_DAY = new Date("2026-08-03T00:00:00.000Z");

let auth: { Authorization: string };
let projectId: string;

beforeEach(async () => {
  await resetDb();
  const admin = await signInAs();
  auth = admin.auth;
  ({ projectId } = await seedProject(admin.user.id));
});
afterAll(async () => { await prisma.$disconnect(); });

async function adSetOf(campaignId: string, name: string, optimizationGoal: string | null, results: number, spend: number, position = 0) {
  const adSet = await prisma.adSet.create({ data: { campaignId, name, optimizationGoal, position } });
  if (results > 0 || spend > 0) {
    await prisma.adSetDailyMetric.create({ data: { adSetId: adSet.id, date: DAY, results, spend } });
  }
  return adSet;
}

async function mixedCampaign() {
  const campaign = await seedCampaign(projectId, "Смешанная", "META");
  await adSetOf(campaign.id, "Сообщения", "CONVERSATIONS", 120, 3000);
  await adSetOf(campaign.id, "Профиль", "PROFILE_VISIT", 45, 900, 1);
  await prisma.campaignDailyMetric.create({ data: { campaignId: campaign.id, date: DAY, results: 165, spend: 3900 } });
  return campaign;
}

const campaignOf = async (id: string) =>
  (await request(app).get(`/api/campaigns/${id}${RANGE}`).set(auth)).body;

describe("the result types of a campaign", () => {
  it("names the types it optimises for and reports results and spend of each", async () => {
    const campaign = await mixedCampaign();

    const body = await campaignOf(campaign.id);

    expect(body.resultTypes).toEqual(["MESSAGES", "PROFILE_VISITS"]);
    expect(body.performance.results).toBe(165);
    expect(body.performance.resultTypes).toEqual([
      { type: "MESSAGES", results: 120, spend: 3000 },
      { type: "PROFILE_VISITS", results: 45, spend: 900 },
    ]);
  });

  it("still names its types in a period with nothing measured", async () => {
    const campaign = await seedCampaign(projectId, "Тихая", "META");
    await adSetOf(campaign.id, "Группа", "CONVERSATIONS", 0, 0);

    const body = await campaignOf(campaign.id);

    expect(body.resultTypes).toEqual(["MESSAGES"]);
    expect(body.performance.resultTypes).toEqual([]);
  });

  it("counts only the days of the range", async () => {
    const campaign = await seedCampaign(projectId, "Сообщения", "META");
    const adSet = await adSetOf(campaign.id, "Группа", "CONVERSATIONS", 10, 100);
    await prisma.adSetDailyMetric.create({ data: { adSetId: adSet.id, date: new Date("2026-07-01T00:00:00.000Z"), results: 500, spend: 5000 } });

    expect((await campaignOf(campaign.id)).performance.resultTypes).toEqual([{ type: "MESSAGES", results: 10, spend: 100 }]);
  });

  it("calls the results of a Google campaign imported before its categories conversions", async () => {
    const campaign = await seedCampaign(projectId, "Поиск", "GOOGLE");
    await prisma.campaignDailyMetric.create({ data: { campaignId: campaign.id, date: DAY, conversions: 9, results: 9, spend: 450 } });

    const body = await campaignOf(campaign.id);

    expect(body.resultTypes).toEqual(["CONVERSIONS"]);
    expect(body.performance.resultTypes).toEqual([{ type: "CONVERSIONS", results: 9, spend: 450 }]);
  });

  it("names the types of a Google campaign's categories, each costing the campaign's whole spend", async () => {
    const campaign = await seedCampaign(projectId, "Поиск", "GOOGLE");
    await prisma.campaign.update({ where: { id: campaign.id }, data: { conversionCategories: ["SUBMIT_LEAD_FORM", "CONTACT", "PHONE_CALL_LEAD"] } });
    await prisma.campaignDailyMetric.createMany({ data: [
      { campaignId: campaign.id, date: DAY, results: 10, spend: 300 },
      { campaignId: campaign.id, date: NEXT_DAY, results: 0, spend: 100 },
    ] });
    await prisma.campaignDailyResult.createMany({ data: [
      { campaignId: campaign.id, date: DAY, category: "SUBMIT_LEAD_FORM", results: 1 },
      { campaignId: campaign.id, date: DAY, category: "IMPORTED_LEAD", results: 3 },
      { campaignId: campaign.id, date: DAY, category: "CONTACT", results: 6 },
    ] });

    const body = await campaignOf(campaign.id);

    expect(body.resultTypes).toEqual(["LEADS", "CALLS", "CONTACTS"]);
    expect(body.performance.resultTypes).toEqual([
      { type: "CONTACTS", results: 6, spend: 400 },
      { type: "LEADS", results: 4, spend: 400 },
      { type: "CALLS", results: 0, spend: 400 },
    ]);
  });

  it("reports a Google ad group's and ad's results by category", async () => {
    const campaign = await seedCampaign(projectId, "Поиск", "GOOGLE");
    await prisma.campaign.update({ where: { id: campaign.id }, data: { conversionCategories: ["CONTACT"] } });
    const adSet = await prisma.adSet.create({ data: { campaignId: campaign.id, name: "Группа", position: 0 } });
    const ad = await prisma.ad.create({ data: { adSetId: adSet.id, name: "Объявление", position: 0 } });
    await prisma.adSetDailyMetric.create({ data: { adSetId: adSet.id, date: DAY, spend: 50 } });
    await prisma.adSetDailyResult.create({ data: { adSetId: adSet.id, date: DAY, category: "CONTACT", results: 2.5 } });
    await prisma.adDailyMetric.create({ data: { adId: ad.id, date: DAY, spend: 20 } });
    await prisma.adDailyResult.create({ data: { adId: ad.id, date: DAY, category: "CONTACT", results: 1 } });

    const [group] = (await request(app).get(`/api/campaigns/${campaign.id}/ad-sets${RANGE}`).set(auth)).body;
    const [shown] = (await request(app).get(`/api/ad-sets/${adSet.id}/ads${RANGE}`).set(auth)).body;

    expect(group.performance.resultTypes).toEqual([{ type: "CONTACTS", results: 2.5, spend: 50 }]);
    expect(shown.performance.resultTypes).toEqual([{ type: "CONTACTS", results: 1, spend: 20 }]);
  });

  it("files results under unknown while no goal was imported", async () => {
    const campaign = await seedCampaign(projectId, "Старая", "META");
    await adSetOf(campaign.id, "Группа", null, 30, 600);

    const body = await campaignOf(campaign.id);

    expect(body.resultTypes).toEqual(["UNKNOWN"]);
    expect(body.performance.resultTypes).toEqual([{ type: "UNKNOWN", results: 30, spend: 600 }]);
  });

  it("files the results of a campaign without ad sets under unknown", async () => {
    const campaign = await seedCampaign(projectId, "Ручная", "YANDEX");
    await prisma.campaignDailyMetric.create({ data: { campaignId: campaign.id, date: DAY, results: 5, spend: 50 } });

    const body = await campaignOf(campaign.id);

    expect(body.resultTypes).toEqual([]);
    expect(body.performance.resultTypes).toEqual([{ type: "UNKNOWN", results: 5, spend: 50 }]);
  });

  it("comes with each campaign of a project's list", async () => {
    await mixedCampaign();

    const res = await request(app).get(`/api/projects/${projectId}/campaigns${RANGE}`).set(auth);

    expect(res.body[0].resultTypes).toEqual(["MESSAGES", "PROFILE_VISITS"]);
    expect(res.body[0].performance.resultTypes).toHaveLength(2);
  });
});

describe("the result type of an ad set and its ads", () => {
  it("is the ad set's, and its ads take it, each with its own figures", async () => {
    const campaign = await seedCampaign(projectId, "Профиль", "META");
    const adSet = await adSetOf(campaign.id, "Группа", "PROFILE_VISIT", 3, 60);
    const ad = await prisma.ad.create({ data: { adSetId: adSet.id, name: "Объявление", position: 0 } });
    await prisma.adDailyMetric.create({ data: { adId: ad.id, date: DAY, results: 2, spend: 40 } });

    const sets = await request(app).get(`/api/campaigns/${campaign.id}/ad-sets${RANGE}`).set(auth);
    const ads = await request(app).get(`/api/ad-sets/${adSet.id}/ads${RANGE}`).set(auth);

    expect(sets.body[0].resultType).toBe("PROFILE_VISITS");
    expect(sets.body[0]).not.toHaveProperty("optimizationGoal");
    expect(sets.body[0].performance.resultTypes).toEqual([{ type: "PROFILE_VISITS", results: 3, spend: 60 }]);
    expect(ads.body[0].resultType).toBe("PROFILE_VISITS");
    expect(ads.body[0].performance.resultTypes).toEqual([{ type: "PROFILE_VISITS", results: 2, spend: 40 }]);
  });
});

describe("a project's figures by type", () => {
  it("are in the project summary", async () => {
    await mixedCampaign();

    const res = await request(app).get(`/api/projects/${projectId}/summary${RANGE}`).set(auth);

    expect(res.body.resultTypes).toEqual([
      { type: "MESSAGES", results: 120, spend: 3000 },
      { type: "PROFILE_VISITS", results: 45, spend: 900 },
    ]);
  });

  it("are in the dashboard project and each of its days", async () => {
    const campaign = await mixedCampaign();
    const adSet = await prisma.adSet.findFirstOrThrow({ where: { campaignId: campaign.id, optimizationGoal: "CONVERSATIONS" } });
    await prisma.adSetDailyMetric.create({ data: { adSetId: adSet.id, date: NEXT_DAY, results: 10, spend: 200 } });
    await prisma.campaignDailyMetric.create({ data: { campaignId: campaign.id, date: NEXT_DAY, results: 10, spend: 200 } });

    const res = await request(app).get(`/api/summary/projects${RANGE}`).set(auth);
    const project = res.body.find((entry: { projectId: string }) => entry.projectId === projectId);

    expect(project.performance.resultTypes).toEqual([
      { type: "MESSAGES", results: 130, spend: 3200 },
      { type: "PROFILE_VISITS", results: 45, spend: 900 },
    ]);
    expect(project.days.map((day: { date: string; resultTypes: unknown[] }) => [day.date, day.resultTypes])).toEqual([
      ["2026-08-02", [{ type: "MESSAGES", results: 120, spend: 3000 }, { type: "PROFILE_VISITS", results: 45, spend: 900 }]],
      ["2026-08-03", [{ type: "MESSAGES", results: 10, spend: 200 }]],
    ]);
  });
});
