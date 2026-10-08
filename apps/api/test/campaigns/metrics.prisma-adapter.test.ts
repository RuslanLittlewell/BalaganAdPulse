import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";
import { PrismaMetricRepository } from "../../src/modules/campaigns/infrastructure/prisma-metric-repository.js";

const repository = new PrismaMetricRepository(prisma);
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

let campaignId: string;

beforeEach(async () => {
  await resetDb();
  const admin = await signInAs();
  const { projectId } = await seedProject(admin.user.id);
  const campaign = await prisma.campaign.create({
    data: { projectId, name: "Поиск / Москва", channel: "YANDEX", position: 0 },
  });
  campaignId = campaign.id;
});
afterAll(async () => { await prisma.$disconnect(); });

const figures = (partial: Record<string, number> = {}) => ({
  spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, revenue: 0, ...partial,
});

const recordCampaignDay = (id: string, date: Date, partial?: Record<string, number>) =>
  prisma.campaignDailyMetric.create({ data: { campaignId: id, date, ...figures(partial) } });
const recordAdSetDay = (id: string, date: Date, partial?: Record<string, number>) =>
  prisma.adSetDailyMetric.create({ data: { adSetId: id, date, ...figures(partial) } });
const recordAdDay = (id: string, date: Date, partial?: Record<string, number>) =>
  prisma.adDailyMetric.create({ data: { adId: id, date, ...figures(partial) } });

describe("a day of measured figures", () => {
  it("reads back what the platform reported", async () => {
    await recordCampaignDay(campaignId, day("2026-08-01"), {
      spend: 1200.5, impressions: 40000, reach: 15000, clicks: 800, conversions: 24, revenue: 4800,
    });

    const [stored] = await repository.readCampaignRange(campaignId, day("2026-08-01"), day("2026-08-01"));

    expect(stored).toEqual({
      date: day("2026-08-01"),
      spend: 1200.5, impressions: 40000, reach: 15000, clicks: 800, conversions: 24, revenue: 4800,
    });
  });

  it("is stored at most once per campaign and date", async () => {
    await recordCampaignDay(campaignId, day("2026-08-01"), { spend: 100 });

    await expect(recordCampaignDay(campaignId, day("2026-08-01"), { spend: 140 })).rejects.toThrow();
    expect(await repository.readCampaignRange(campaignId, day("2026-08-01"), day("2026-08-01"))).toHaveLength(1);
  });
});

describe("reading a range", () => {
  beforeEach(async () => {
    await recordCampaignDay(campaignId, day("2026-07-31"), { spend: 999 });
    await recordCampaignDay(campaignId, day("2026-08-01"), { spend: 100 });
    await recordCampaignDay(campaignId, day("2026-08-03"), { spend: 40 });
    await recordCampaignDay(campaignId, day("2026-08-05"), { spend: 7 });
    await recordCampaignDay(campaignId, day("2026-08-06"), { spend: 888 });
  });

  it("includes both endpoints and nothing outside them", async () => {
    const rows = await repository.readCampaignRange(campaignId, day("2026-08-01"), day("2026-08-05"));
    expect(rows.map((row) => row.spend).sort((a, b) => a - b)).toEqual([7, 40, 100]);
  });

  it("returns nothing for a range with no rows in it", async () => {
    expect(await repository.readCampaignRange(campaignId, day("2026-09-01"), day("2026-09-30"))).toEqual([]);
  });

  it("never reads another campaign's days", async () => {
    const { projectId } = await seedProject((await signInAs("Other")).user.id, "Other");
    const other = await prisma.campaign.create({
      data: { projectId, name: "Их кампания", channel: "META", position: 0 },
    });
    await recordCampaignDay(other.id, day("2026-08-01"), { spend: 5000 });

    const rows = await repository.readCampaignRange(campaignId, day("2026-08-01"), day("2026-08-05"));

    expect(rows.map((row) => row.spend)).not.toContain(5000);
  });
});

describe("the hierarchy beneath a campaign", () => {
  it("records days against an ad set and an ad", async () => {
    const adSet = await prisma.adSet.create({
      data: { campaignId, name: "Москва · 28–55", position: 0 },
    });
    const ad = await prisma.ad.create({
      data: { adSetId: adSet.id, name: "Приём в день обращения", position: 0 },
    });

    await recordAdSetDay(adSet.id, day("2026-08-01"), { spend: 60 });
    await recordAdDay(ad.id, day("2026-08-01"), { spend: 25 });

    expect(await repository.readAdSetRange(adSet.id, day("2026-08-01"), day("2026-08-01")))
      .toMatchObject([{ spend: 60 }]);
    expect(await repository.readAdRange(ad.id, day("2026-08-01"), day("2026-08-01")))
      .toMatchObject([{ spend: 25 }]);
  });

  it("takes the ad sets, ads and their figures with a deleted campaign", async () => {
    const adSet = await prisma.adSet.create({ data: { campaignId, name: "Группа", position: 0 } });
    const ad = await prisma.ad.create({ data: { adSetId: adSet.id, name: "Объявление", position: 0 } });
    await recordCampaignDay(campaignId, day("2026-08-01"), { spend: 10 });
    await recordAdSetDay(adSet.id, day("2026-08-01"), { spend: 6 });
    await recordAdDay(ad.id, day("2026-08-01"), { spend: 3 });

    await prisma.campaign.delete({ where: { id: campaignId } });

    expect(await prisma.adSet.count()).toBe(0);
    expect(await prisma.ad.count()).toBe(0);
    expect(await prisma.campaignDailyMetric.count()).toBe(0);
    expect(await prisma.adSetDailyMetric.count()).toBe(0);
    expect(await prisma.adDailyMetric.count()).toBe(0);
  });
});
