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

describe("recording a day of measured figures", () => {
  it("stores what the platform reported", async () => {
    await repository.recordCampaignDay(campaignId, day("2026-08-01"), figures({
      spend: 1200.5, impressions: 40000, reach: 15000, clicks: 800, conversions: 24, revenue: 4800,
    }));

    const [stored] = await repository.readCampaignRange(campaignId, day("2026-08-01"), day("2026-08-01"));

    // The date comes back with the figures: a summary drops it, but the chart
    // cannot label an axis without it.
    expect(stored).toEqual({
      date: day("2026-08-01"),
      spend: 1200.5, impressions: 40000, reach: 15000, clicks: 800, conversions: 24, revenue: 4800,
    });
  });

  /**
   * Platforms restate a day as attribution settles, so the same date arrives
   * again with different numbers. Appending would silently double that day's
   * spend the first time a sync ran twice.
   */
  it("replaces a day already recorded rather than adding to it", async () => {
    await repository.recordCampaignDay(campaignId, day("2026-08-01"), figures({ spend: 100, clicks: 10 }));
    await repository.recordCampaignDay(campaignId, day("2026-08-01"), figures({ spend: 140, clicks: 13 }));

    const rows = await repository.readCampaignRange(campaignId, day("2026-08-01"), day("2026-08-01"));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ spend: 140, clicks: 13 });
  });
});

describe("reading a range", () => {
  beforeEach(async () => {
    await repository.recordCampaignDay(campaignId, day("2026-07-31"), figures({ spend: 999 }));
    await repository.recordCampaignDay(campaignId, day("2026-08-01"), figures({ spend: 100 }));
    await repository.recordCampaignDay(campaignId, day("2026-08-03"), figures({ spend: 40 }));
    await repository.recordCampaignDay(campaignId, day("2026-08-05"), figures({ spend: 7 }));
    await repository.recordCampaignDay(campaignId, day("2026-08-06"), figures({ spend: 888 }));
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
    await repository.recordCampaignDay(other.id, day("2026-08-01"), figures({ spend: 5000 }));

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

    await repository.recordAdSetDay(adSet.id, day("2026-08-01"), figures({ spend: 60 }));
    await repository.recordAdDay(ad.id, day("2026-08-01"), figures({ spend: 25 }));

    expect(await repository.readAdSetRange(adSet.id, day("2026-08-01"), day("2026-08-01")))
      .toMatchObject([{ spend: 60 }]);
    expect(await repository.readAdRange(ad.id, day("2026-08-01"), day("2026-08-01")))
      .toMatchObject([{ spend: 25 }]);
  });

  // The database enforces this, not the application: a measured figure cannot
  // outlive the thing it measured.
  it("takes the ad sets, ads and their figures with a deleted campaign", async () => {
    const adSet = await prisma.adSet.create({ data: { campaignId, name: "Группа", position: 0 } });
    const ad = await prisma.ad.create({ data: { adSetId: adSet.id, name: "Объявление", position: 0 } });
    await repository.recordCampaignDay(campaignId, day("2026-08-01"), figures({ spend: 10 }));
    await repository.recordAdSetDay(adSet.id, day("2026-08-01"), figures({ spend: 6 }));
    await repository.recordAdDay(ad.id, day("2026-08-01"), figures({ spend: 3 }));

    await prisma.campaign.delete({ where: { id: campaignId } });

    expect(await prisma.adSet.count()).toBe(0);
    expect(await prisma.ad.count()).toBe(0);
    expect(await prisma.campaignDailyMetric.count()).toBe(0);
    expect(await prisma.adSetDailyMetric.count()).toBe(0);
    expect(await prisma.adDailyMetric.count()).toBe(0);
  });
});
