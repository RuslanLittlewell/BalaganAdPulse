import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaTrafficJobs } from "../../src/modules/seo/infrastructure/prisma-traffic-jobs.js";
import { PrismaSiteRepository } from "../../src/modules/seo/infrastructure/prisma-site-repository.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs } from "../helpers/auth.js";

const app = createApp();
const jobs = new PrismaTrafficJobs(prisma);
const now = new Date("2026-11-07T06:00:00Z");
let auth: { Authorization: string };
let projectId: string;
let clientId: string;
let siteId: string;
const site = () => `/api/projects/${projectId}/seo/sites/${siteId}`;
const date = (value: string) => new Date(`${value}T00:00:00Z`);
const row = (day: string, channel: string, source: string, medium: string, sessions: number) => ({ siteId, date: date(day), channel, source, medium, sessions });

beforeEach(async () => {
  await resetDb();
  const member = await signInAs();
  ({ auth } = member);
  ({ projectId, clientId } = await seedProject(member.user.id));
  siteId = (await prisma.seoSite.create({ data: {
    projectId, siteUrl: "https://shop.ru/", encryptedToken: "sealed", revision: "v1", status: "SUCCESS",
    nextDailyAt: new Date("2030-01-01"), nextCheckAt: new Date("2030-01-01"),
  } })).id;
});
afterAll(() => prisma.$disconnect());

const link = () => prisma.seoSite.update({ where: { id: siteId }, data: {
  analyticsPropertyId: "111", analyticsName: "Acme / shop.ru", trafficStatus: "SUCCESS", trafficSuccessAt: now, nextTrafficAt: new Date("2030-01-01"),
} });

describe("a site's traffic", () => {
  it("says traffic is not connected while no property is linked", async () => {
    const res = await request(app).get(`${site()}/traffic?from=2026-11-01&to=2026-11-04`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ connected: false });
  });

  it("totals channels with shares and the previous period, and lists sources and days", async () => {
    await link();
    await prisma.seoTrafficDay.createMany({ data: [
      row("2026-11-01", "Organic Search", "google", "organic", 400),
      row("2026-11-02", "Organic Search", "google", "organic", 200),
      row("2026-11-02", "Direct", "(direct)", "(none)", 400),
      row("2026-10-28", "Organic Search", "google", "organic", 500),
      row("2026-10-28", "Paid Search", "google", "cpc", 70),
    ] });

    const res = await request(app).get(`${site()}/traffic?from=2026-11-01&to=2026-11-04`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ connected: true, propertyName: "Acme / shop.ru", totalSessions: 1000, previousSessions: 570 });
    expect(res.body.channels).toEqual([
      { channel: "Organic Search", sessions: 600, share: 0.6, previous: 500 },
      { channel: "Direct", sessions: 400, share: 0.4, previous: 0 },
      { channel: "Paid Search", sessions: 0, share: 0, previous: 70 },
    ]);
    expect(res.body.sources[0]).toEqual({ source: "google", medium: "organic", sessions: 600, share: 0.6 });
    expect(res.body.days).toEqual([{ date: "2026-11-01", sessions: 400 }, { date: "2026-11-02", sessions: 600 }]);
  });

  it("answers zeros and no shares for a period without sessions", async () => {
    await link();
    const res = await request(app).get(`${site()}/traffic?from=2026-11-01&to=2026-11-04`).set(auth);
    expect(res.body).toMatchObject({ connected: true, totalSessions: 0, channels: [], sources: [], days: [] });
  });

  it("is read by a client's person who reaches the project", async () => {
    const person = await signInAs("Client", { role: "CLIENT" });
    await grantAccess(person.membership!.id, clientId);
    expect((await request(app).get(`${site()}/traffic?from=2026-11-01&to=2026-11-04`).set(person.auth)).status).toBe(200);
  });

  it("answers 404 for another project's site", async () => {
    const other = await seedProject("x", "Other");
    expect((await request(app).get(`/api/projects/${other.projectId}/seo/sites/${siteId}/traffic?from=2026-11-01&to=2026-11-04`).set(auth)).status).toBe(404);
  });

  it("never carries a credential", async () => {
    await link();
    const body = JSON.stringify((await request(app).get(`${site()}/traffic?from=2026-11-01&to=2026-11-04`).set(auth)).body)
      + JSON.stringify((await request(app).get(`/api/projects/${projectId}/seo/sites`).set(auth)).body);
    expect(body).not.toContain("sealed");
  });
});

describe("managing the Analytics link", () => {
  it("refuses clients who may edit the project", async () => {
    const person = await signInAs("Client", { role: "CLIENT" });
    await grantAccess(person.membership!.id, clientId);
    expect((await request(app).post(`${site()}/analytics/authorize`).set(person.auth)).status).toBe(403);
    expect((await request(app).delete(`${site()}/analytics`).set(person.auth)).status).toBe(403);
  });

  it("reports that Google is not configured", async () => {
    const res = await request(app).post(`${site()}/analytics/authorize`).set(auth);
    expect(res.status).toBe(400);
  });

  it("unlinks the property, deletes its traffic and keeps the search data", async () => {
    await link();
    await prisma.seoDay.create({ data: { siteId, date: date("2026-11-01"), clicks: 1, impressions: 10, position: 3 } });
    await prisma.seoTrafficDay.create({ data: row("2026-11-01", "Direct", "(direct)", "(none)", 5) });

    const res = await request(app).delete(`${site()}/analytics`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body.analytics).toBeNull();
    expect(await prisma.seoTrafficDay.count({ where: { siteId } })).toBe(0);
    expect(await prisma.seoDay.count({ where: { siteId } })).toBe(1);
  });

  it("replaces a linked property and its traffic data when another is linked", async () => {
    await link();
    await prisma.seoTrafficDay.create({ data: row("2026-11-01", "Direct", "(direct)", "(none)", 5) });
    const repository = new PrismaSiteRepository(prisma, { clientFor: () => prisma } as never);

    await repository.linkAnalytics({} as never, siteId, { encryptedToken: "fresh", propertyId: "222", name: "Other" }, now);

    expect(await prisma.seoTrafficDay.count({ where: { siteId } })).toBe(0);
    expect(await prisma.seoSite.findUnique({ where: { id: siteId } })).toMatchObject({ analyticsPropertyId: "222", encryptedToken: "fresh", trafficStatus: "QUEUED" });
  });
});

describe("adding a site with a property", () => {
  it("queues the first traffic import for a site created with its property", async () => {
    const repository = new PrismaSiteRepository(prisma, { clientFor: () => prisma } as never);

    const added = await repository.add({} as never, { projectId, siteUrl: "https://blog.ru/", encryptedToken: "sealed", analytics: { propertyId: "333", name: "Acme / blog.ru" } }, now);

    expect(added).toMatchObject({ analyticsPropertyId: "333", analyticsName: "Acme / blog.ru", trafficStatus: "QUEUED", trafficQueuedAt: now });
    expect((await jobs.claim(now))?.id).toBe(added.id);
  });

  it("leaves a site created without a property out of the traffic jobs", async () => {
    const repository = new PrismaSiteRepository(prisma, { clientFor: () => prisma } as never);
    await repository.add({} as never, { projectId, siteUrl: "https://blog.ru/", encryptedToken: "sealed" }, now);
    expect(await jobs.claim(now)).toBeNull();
  });
});

describe("renewing the sign-in of a linked site", () => {
  it("keeps the traffic data and the short refresh when the same property is chosen again", async () => {
    await link();
    await prisma.seoTrafficDay.create({ data: row("2026-11-01", "Direct", "(direct)", "(none)", 5) });
    const repository = new PrismaSiteRepository(prisma, { clientFor: () => prisma } as never);

    await repository.linkAnalytics({} as never, siteId, { encryptedToken: "fresh", propertyId: "111", name: "Acme / shop.ru" }, now);

    expect(await prisma.seoTrafficDay.count({ where: { siteId } })).toBe(1);
    expect(await prisma.seoSite.findUnique({ where: { id: siteId } })).toMatchObject({ trafficSuccessAt: now, encryptedToken: "fresh", trafficStatus: "QUEUED" });
  });
});

describe("the traffic jobs", () => {
  const snapshot = (rows = [{ date: "2026-11-05", channel: "Direct", source: "(direct)", medium: "(none)", sessions: 7 }]) =>
    ({ from: "2026-11-04", to: "2026-11-06", rows });

  it("claims only linked sites that are queued or due", async () => {
    expect(await jobs.claim(now)).toBeNull();
    await prisma.seoSite.update({ where: { id: siteId }, data: { analyticsPropertyId: "111", trafficQueuedAt: now } });
    const job = await jobs.claim(now);
    expect(job).toMatchObject({ id: siteId, trafficStatus: "RUNNING" });
    expect(await jobs.claim(now)).toBeNull();
  });

  it("replaces the re-read days when it completes and drops days older than 90", async () => {
    await prisma.seoSite.update({ where: { id: siteId }, data: { analyticsPropertyId: "111", trafficQueuedAt: now } });
    await prisma.seoTrafficDay.createMany({ data: [
      row("2026-11-05", "Direct", "(direct)", "(none)", 1),
      row("2026-11-05", "Referral", "t.me", "referral", 1),
      row("2026-07-01", "Direct", "(direct)", "(none)", 9),
    ] });
    const job = (await jobs.claim(now))!;

    expect(await jobs.complete(job, snapshot(), now)).toBe(true);

    const stored = await prisma.seoTrafficDay.findMany({ where: { siteId } });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ source: "(direct)", sessions: 7 });
    expect(await prisma.seoSite.findUnique({ where: { id: siteId } })).toMatchObject({ trafficStatus: "SUCCESS", trafficSuccessAt: now, trafficLeaseOwner: null });
  });

  it("publishes nothing when the lease was lost", async () => {
    await prisma.seoSite.update({ where: { id: siteId }, data: { analyticsPropertyId: "111", trafficQueuedAt: now } });
    const job = (await jobs.claim(now))!;
    await prisma.seoSite.update({ where: { id: siteId }, data: { trafficLeaseOwner: "someone-else" } });

    expect(await jobs.complete(job, snapshot(), now)).toBe(false);
    expect(await prisma.seoTrafficDay.count({ where: { siteId } })).toBe(0);
  });

  it("retries a provider failure, asks to sign in again on a rejected token and keeps the data", async () => {
    await prisma.seoSite.update({ where: { id: siteId }, data: { analyticsPropertyId: "111", trafficQueuedAt: now } });
    await prisma.seoTrafficDay.create({ data: row("2026-11-05", "Direct", "(direct)", "(none)", 3) });
    const job = (await jobs.claim(now))!;
    await jobs.fail(job, "PROVIDER", 0, now);
    expect(await prisma.seoSite.findUnique({ where: { id: siteId } })).toMatchObject({ trafficStatus: "QUEUED", trafficError: "PROVIDER", trafficRetryCount: 1 });

    const later = new Date(now.getTime() + 3_600_000);
    const again = (await jobs.claim(later))!;
    await jobs.fail(again, "TOKEN", 0, later);
    expect(await prisma.seoSite.findUnique({ where: { id: siteId } })).toMatchObject({ trafficStatus: "AUTH_REQUIRED", trafficQueuedAt: null });
    expect(await prisma.seoTrafficDay.count({ where: { siteId } })).toBe(1);
    expect(await jobs.claim(new Date(later.getTime() + 10 * 86_400_000))).toBeNull();
  });
});
