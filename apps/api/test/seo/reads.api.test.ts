import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs } from "../helpers/auth.js";

const app = createApp();
let auth: { Authorization: string };
let projectId: string;
let clientId: string;
let siteId: string;
const site = () => `/api/projects/${projectId}/seo/sites/${siteId}`;
const date = (value: string) => new Date(`${value}T00:00:00Z`);

beforeEach(async () => {
  await resetDb();
  const member = await signInAs();
  ({ auth } = member);
  ({ projectId, clientId } = await seedProject(member.user.id));
  siteId = (await prisma.seoSite.create({ data: {
    projectId, siteUrl: "https://shop.ru/", encryptedToken: "sealed", revision: "v1", status: "SUCCESS",
    nextDailyAt: new Date(), nextCheckAt: new Date(), vitalsReadAt: new Date("2026-11-06T06:00:00Z"),
  } })).id;
  await prisma.seoDay.createMany({ data: [
    { siteId, date: date("2026-10-30"), clicks: 10, impressions: 500, position: 9 },
    { siteId, date: date("2026-11-01"), clicks: 4, impressions: 100, position: 2 },
    { siteId, date: date("2026-11-02"), clicks: 6, impressions: 300, position: 10 },
  ] });
});
afterAll(() => prisma.$disconnect());

describe("a site's search figures", () => {
  it("total the period, compare it with the one before and list each day", async () => {
    const res = await request(app).get(`${site()}/search?from=2026-11-01&to=2026-11-04`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      latestDay: "2026-11-02",
      totals: { clicks: 10, impressions: 400, ctr: 0.025, position: 8 },
      previous: { clicks: 10, impressions: 500, ctr: 0.02, position: 9 },
    });
    expect(res.body.days.map((day: { date: string }) => day.date)).toEqual(["2026-11-01", "2026-11-02"]);
  });

  it("are read by a client's person who reaches the project", async () => {
    const person = await signInAs("Client", { role: "CLIENT" });
    await grantAccess(person.membership!.id, clientId);
    expect((await request(app).get(`${site()}/search?from=2026-11-01&to=2026-11-04`).set(person.auth)).status).toBe(200);
  });

  it("refuse a period that ends before it starts", async () => {
    expect((await request(app).get(`${site()}/search?from=2026-11-04&to=2026-11-01`).set(auth)).status).toBe(400);
  });

  it("answer 404 for another project's site", async () => {
    const other = await seedProject("x", "Other");
    expect((await request(app).get(`/api/projects/${other.projectId}/seo/sites/${siteId}/search?from=2026-11-01&to=2026-11-04`).set(auth)).status).toBe(404);
  });
});

describe("a site's top queries and pages", () => {
  beforeEach(async () => {
    await prisma.seoQueryDay.createMany({ data: [
      { siteId, date: date("2026-11-01"), query: "окна", clicks: 3, impressions: 60, position: 2 },
      { siteId, date: date("2026-11-02"), query: "окна", clicks: 2, impressions: 40, position: 4 },
      { siteId, date: date("2026-11-02"), query: "двери", clicks: 4, impressions: 50, position: 5 },
      { siteId, date: date("2026-11-02"), query: "рамы", clicks: 1, impressions: 10, position: 7 },
    ] });
  });

  it("rank the period's items by clicks with their share of the clicks", async () => {
    const res = await request(app).get(`${site()}/top?kind=query&from=2026-11-01&to=2026-11-04&limit=2`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ kind: "query", partial: false, totalClicks: 10 });
    expect(res.body.items).toEqual([
      { key: "окна", clicks: 5, impressions: 100, ctr: 0.05, position: 2.8, share: 0.5 },
      { key: "двери", clicks: 4, impressions: 50, ctr: 0.08, position: 5, share: 0.4 },
    ]);
  });

  it("say when the period reaches back past the kept days", async () => {
    const res = await request(app).get(`${site()}/top?kind=query&from=2026-05-01&to=2026-11-04`).set(auth);
    expect(res.body).toMatchObject({ partial: true, from: "2026-11-01" });
  });

  it("refuse an unknown kind and more than 100 items", async () => {
    expect((await request(app).get(`${site()}/top?kind=word&from=2026-11-01&to=2026-11-04`).set(auth)).status).toBe(400);
    expect((await request(app).get(`${site()}/top?kind=page&from=2026-11-01&to=2026-11-04&limit=500`).set(auth)).status).toBe(400);
  });
});

describe("a site's Core Web Vitals", () => {
  beforeEach(async () => {
    const phone = (metric: string, p75: number) => ({ siteId, device: "PHONE", metric, periodEnd: date("2026-11-05"), p75, good: 0.8, needsImprovement: 0.15, poor: 0.05 });
    await prisma.seoVital.createMany({ data: [phone("LCP", 2100), phone("INP", 150), phone("CLS", 0.05)] });
    await prisma.seoVitalWeek.createMany({ data: [
      { siteId, device: "PHONE", metric: "LCP", periodEnd: date("2026-10-25"), p75: 2300 },
      { siteId, device: "PHONE", metric: "LCP", periodEnd: date("2026-09-01"), p75: 2900 },
    ] });
    await prisma.seoLab.create({ data: { siteId, device: "DESKTOP", measuredAt: new Date("2026-11-05T06:00:00Z"), score: 45, lcpMs: 4100, cls: 0.2, tbtMs: 600, fcpMs: 2000, speedIndexMs: 5000 } });
  });

  it("rate each device and say whether it passes, with weekly history inside the period", async () => {
    const res = await request(app).get(`${site()}/vitals?from=2026-10-01&to=2026-11-06`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
    const [phone, desktop] = res.body.devices;
    expect(phone).toMatchObject({ device: "PHONE", passes: true, periodEnd: "2026-11-05" });
    expect(phone.metrics.map((metric: { metric: string; rating: string }) => [metric.metric, metric.rating])).toEqual([
      ["LCP", "GOOD"], ["INP", "GOOD"], ["CLS", "GOOD"],
    ]);
    expect(phone.metrics[0].weeks).toEqual([{ periodEnd: "2026-10-25", p75: 2300 }]);
    expect(desktop).toMatchObject({ device: "DESKTOP", passes: null, metrics: [], lab: { score: 45, rating: "POOR", lcpMs: 4100 } });
  });
});
