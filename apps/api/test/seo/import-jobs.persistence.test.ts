import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaImportJobs } from "../../src/modules/seo/infrastructure/prisma-import-jobs.js";
import type { SearchSnapshot } from "../../src/modules/seo/domain/search.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

const jobs = new PrismaImportJobs(prisma);
const now = new Date("2026-11-07T06:00:00Z");
let projectId: string;
let siteId: string;

const snapshot = (over: Partial<SearchSnapshot> = {}): SearchSnapshot => ({
  from: "2026-10-28",
  to: "2026-11-06",
  topFrom: "2026-10-28",
  days: [{ date: "2026-11-05", clicks: 40, impressions: 900, position: 6.5 }],
  queries: [{ date: "2026-11-05", key: "купить окна", clicks: 12, impressions: 200, position: 3.2 }],
  pages: [{ date: "2026-11-05", key: "https://shop.ru/okna", clicks: 20, impressions: 300, position: 4 }],
  ...over,
});

const claimed = async () => (await jobs.claim(now))!;

beforeEach(async () => {
  await resetDb();
  const member = await signInAs();
  ({ projectId } = await seedProject(member.user.id));
  siteId = (await prisma.seoSite.create({ data: {
    projectId, siteUrl: "https://shop.ru/", encryptedToken: "sealed", revision: "v1", status: "QUEUED",
    queuedAt: now, nextDailyAt: new Date("2026-11-08T07:00:00Z"), nextCheckAt: now,
  } })).id;
});
afterAll(() => prisma.$disconnect());

describe("search imports in the database", () => {
  it("claim a queued site once and lease it", async () => {
    const job = await claimed();
    expect(job).toMatchObject({ id: siteId, status: "RUNNING", queuedAt: null });
    expect(await jobs.claim(now)).toBeNull();
  });

  it("publish the figures and mark the site imported", async () => {
    const job = await claimed();

    expect(await jobs.complete(job, snapshot(), now)).toBe(true);

    expect(await prisma.seoDay.findMany({ select: { clicks: true, impressions: true } })).toEqual([{ clicks: 40, impressions: 900 }]);
    expect(await prisma.seoQueryDay.count()).toBe(1);
    expect(await prisma.seoPageDay.count()).toBe(1);
    expect(await prisma.seoSite.findUniqueOrThrow({ where: { id: siteId } })).toMatchObject({ status: "SUCCESS", lastSuccessAt: now, leaseOwner: null });
  });

  it("replace a day imported again rather than add to it", async () => {
    await jobs.complete(await claimed(), snapshot(), now);
    await prisma.seoSite.update({ where: { id: siteId }, data: { queuedAt: now } });

    await jobs.complete(await claimed(), snapshot({ days: [{ date: "2026-11-05", clicks: 52, impressions: 950, position: 6.1 }] }), now);

    expect(await prisma.seoDay.findMany({ select: { clicks: true } })).toEqual([{ clicks: 52 }]);
    expect(await prisma.seoQueryDay.count()).toBe(1);
  });

  it("drop query and page rows older than 90 days", async () => {
    await prisma.seoQueryDay.create({ data: { siteId, date: new Date("2026-08-01"), query: "old", clicks: 1, impressions: 1, position: 1 } });
    await jobs.complete(await claimed(), snapshot(), now);
    expect(await prisma.seoQueryDay.findMany({ select: { query: true } })).toEqual([{ query: "купить окна" }]);
  });

  it("store nothing when the site was disconnected during the import", async () => {
    const job = await claimed();
    await prisma.seoSite.delete({ where: { id: siteId } });

    expect(await jobs.complete(job, snapshot(), now)).toBe(false);
    expect(await prisma.seoDay.count()).toBe(0);
  });

  it("store nothing from a sign-in that was renewed during the import", async () => {
    const job = await claimed();
    await prisma.seoSite.update({ where: { id: siteId }, data: { revision: "v2" } });
    expect(await jobs.complete(job, snapshot(), now)).toBe(false);
  });

  it("ask for a new sign-in when Google revokes the credential, keeping the figures", async () => {
    await jobs.complete(await claimed(), snapshot(), now);
    await prisma.seoSite.update({ where: { id: siteId }, data: { queuedAt: now } });

    await jobs.fail(await claimed(), "TOKEN", 0, now);

    expect(await prisma.seoSite.findUniqueOrThrow({ where: { id: siteId } })).toMatchObject({ status: "AUTH_REQUIRED", lastError: "TOKEN" });
    expect(await prisma.seoDay.count()).toBe(1);
  });

  it("retry a provider failure later", async () => {
    await jobs.fail(await claimed(), "PROVIDER", 0, now);
    const row = await prisma.seoSite.findUniqueOrThrow({ where: { id: siteId } });
    expect(row).toMatchObject({ status: "QUEUED", retryCount: 1, lastError: "PROVIDER" });
    expect(row.queuedAt!.getTime()).toBe(now.getTime() + 60_000);
  });

  it("still claim a site waiting for a sign-in each morning, without calling it running", async () => {
    await prisma.seoSite.update({ where: { id: siteId }, data: { status: "AUTH_REQUIRED", queuedAt: null, nextDailyAt: now } });

    const job = await claimed();
    await jobs.release(job, now);

    expect(job.status).toBe("AUTH_REQUIRED");
    expect(await prisma.seoSite.findUniqueOrThrow({ where: { id: siteId } })).toMatchObject({ status: "AUTH_REQUIRED", leaseOwner: null });
  });
});

describe("Core Web Vitals in the database", () => {
  const reading = { device: "PHONE" as const, metric: "LCP" as const, periodEnd: "2026-11-05", p75: 2100, good: 0.8, needsImprovement: 0.15, poor: 0.05 };

  it("replace the current readings and keep the weekly history", async () => {
    const job = await claimed();
    await jobs.saveVitals(job, "https://shop.ru", {
      readings: [reading],
      weeks: [{ device: "PHONE", metric: "LCP", periodEnd: "2026-10-25", p75: 2300 }, { device: "PHONE", metric: "LCP", periodEnd: "2026-11-01", p75: 2200 }],
    }, now);
    await jobs.saveVitals(job, "https://shop.ru", {
      readings: [],
      weeks: [{ device: "PHONE", metric: "LCP", periodEnd: "2026-11-01", p75: 2150 }],
    }, now);

    expect(await prisma.seoVital.count()).toBe(0);
    const weeks = await prisma.seoVitalWeek.findMany({ orderBy: { periodEnd: "asc" } });
    expect(weeks.map((week) => Number(week.p75))).toEqual([2300, 2150]);
    expect(await prisma.seoSite.findUniqueOrThrow({ where: { id: siteId } })).toMatchObject({ origin: "https://shop.ru", vitalsReadAt: now });
  });
});
