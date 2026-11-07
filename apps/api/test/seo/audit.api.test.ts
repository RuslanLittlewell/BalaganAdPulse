import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaCheckJobs } from "../../src/modules/seo/infrastructure/prisma-check-jobs.js";
import type { CheckedPage } from "../../src/modules/seo/domain/page-audit.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs } from "../helpers/auth.js";

const app = createApp();
const checks = new PrismaCheckJobs(prisma);
const now = new Date("2026-11-07T06:00:00Z");
let auth: { Authorization: string };
let projectId: string;
let clientId: string;
let siteId: string;
const base = () => `/api/projects/${projectId}/seo/sites/${siteId}`;

const facts = {
  lang: "ru", title: "Окна", description: null, keywords: "окна", robots: [], canonical: null, h1: ["Окна"],
  openGraph: { "og:title": "Окна" },
  jsonLd: [
    { source: '{"@type":"Organization"}', types: ["Organization"], error: null },
    { source: '{"@type":"BreadcrumbList"}', types: ["BreadcrumbList"], error: null },
  ],
};
const page = (url: string, over: Partial<CheckedPage> = {}): CheckedPage => ({
  url, inSitemap: true, hasImpressions: false, outcome: "FETCHED", status: 200, finalUrl: url,
  contentType: "text/html", responseMs: 80, facts, ...over,
});

async function finishCheck(pages: CheckedPage[], problems: Record<string, string[]>) {
  await prisma.seoSite.update({ where: { id: siteId }, data: { checkQueuedAt: now } });
  const job = (await checks.claim(now))!;
  await checks.complete(job, {
    pages,
    problems: new Map(Object.entries(problems)) as never,
    notChecked: 3,
    labs: [{ device: "PHONE", score: 72, lcpMs: 3100, cls: 0.02, tbtMs: 300, fcpMs: 1400, speedIndexMs: 3500 }],
  }, now);
}

beforeEach(async () => {
  await resetDb();
  const member = await signInAs();
  ({ auth } = member);
  ({ projectId, clientId } = await seedProject(member.user.id));
  siteId = (await prisma.seoSite.create({ data: {
    projectId, siteUrl: "https://shop.ru/", encryptedToken: "sealed", revision: "v1", status: "SUCCESS",
    nextDailyAt: new Date(), nextCheckAt: new Date("2026-12-01"), checkStatus: "SUCCESS",
  } })).id;
});
afterAll(() => prisma.$disconnect());

describe("a site's page check", () => {
  it("says the pages are being checked before the first check finishes", async () => {
    await prisma.seoSite.update({ where: { id: siteId }, data: { checkStatus: "RUNNING" } });
    const res = await request(app).get(`${base()}/audit`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "RUNNING", lastCheckAt: null, checkError: null, result: null });
  });

  it("groups problems by kind, errors first and then by the pages affected", async () => {
    await finishCheck(
      [page("https://shop.ru/"), page("https://shop.ru/a"), page("https://shop.ru/b"), page("https://shop.ru/gone", { status: 404, facts: null })],
      {
        "https://shop.ru/": ["DESCRIPTION_MISSING"],
        "https://shop.ru/a": ["DESCRIPTION_MISSING"],
        "https://shop.ru/b": ["DESCRIPTION_MISSING", "H1_MULTIPLE"],
        "https://shop.ru/gone": ["HTTP_ERROR"],
      },
    );

    const res = await request(app).get(`${base()}/audit`).set(auth);

    expect(res.body).toMatchObject({
      status: "SUCCESS",
      result: {
        checked: 4, notChecked: 3, pagesWithErrors: 1, pagesWithWarnings: 3,
        kinds: [
          { kind: "HTTP_ERROR", severity: "ERROR", pages: 1 },
          { kind: "DESCRIPTION_MISSING", severity: "WARNING", pages: 3 },
          { kind: "H1_MULTIPLE", severity: "WARNING", pages: 1 },
        ],
      },
    });
  });

  it("lists the pages of one kind, and opens a page with its JSON-LD and search figures", async () => {
    await finishCheck([page("https://shop.ru/"), page("https://shop.ru/a")], { "https://shop.ru/": [], "https://shop.ru/a": ["DESCRIPTION_MISSING"] });
    await prisma.seoPageDay.create({ data: { siteId, date: new Date("2026-11-02"), page: "https://shop.ru/a", clicks: 7, impressions: 70, position: 3.5 } });

    const listed = await request(app).get(`${base()}/audit/pages?kind=DESCRIPTION_MISSING`).set(auth);
    expect(listed.body).toEqual([expect.objectContaining({ url: "https://shop.ru/a", problems: [{ kind: "DESCRIPTION_MISSING", severity: "WARNING" }] })]);

    const opened = await request(app).get(`${base()}/audit/pages/${listed.body[0].id}?from=2026-11-01&to=2026-11-06`).set(auth);
    expect(opened.status).toBe(200);
    expect(opened.body).toMatchObject({
      url: "https://shop.ru/a",
      facts: { title: "Окна", keywords: "окна", jsonLd: [{ types: ["Organization"] }, { types: ["BreadcrumbList"] }] },
      search: { clicks: 7, impressions: 70, position: 3.5 },
    });
  });

  it("keeps the latest check only, and its lab measurement", async () => {
    await finishCheck([page("https://shop.ru/")], {});
    await finishCheck([page("https://shop.ru/"), page("https://shop.ru/a")], {});

    expect(await prisma.seoAudit.count()).toBe(1);
    expect(await prisma.seoAuditPage.count()).toBe(2);
    expect(await prisma.seoLab.findFirst()).toMatchObject({ device: "PHONE", score: 72 });
    expect(await prisma.seoSite.findUniqueOrThrow({ where: { id: siteId } })).toMatchObject({
      checkStatus: "SUCCESS", lastCheckAt: now, nextCheckAt: new Date(now.getTime() + 7 * 86_400_000),
    });
  });

  it("keeps the previous results when a check fails", async () => {
    await finishCheck([page("https://shop.ru/")], {});
    await prisma.seoSite.update({ where: { id: siteId }, data: { checkQueuedAt: now } });

    await checks.fail((await checks.claim(now))!, "UNREACHABLE", now);

    const res = await request(app).get(`${base()}/audit`).set(auth);
    expect(res.body).toMatchObject({ status: "ERROR", checkError: "UNREACHABLE", result: { checked: 1 } });
  });

  it("joins a running check rather than start another", async () => {
    await prisma.seoSite.update({ where: { id: siteId }, data: { checkStatus: "RUNNING", checkLeaseOwner: "worker", checkLeaseUntil: new Date(Date.now() + 60_000) } });
    const res = await request(app).post(`${base()}/audit`).set(auth);
    expect(res.body).toMatchObject({ checkStatus: "RUNNING" });
    expect((await prisma.seoSite.findUniqueOrThrow({ where: { id: siteId } })).checkQueuedAt).toBeNull();
  });

  it("is read by a guest, who may not start one", async () => {
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);
    expect((await request(app).get(`${base()}/audit`).set(guest.auth)).status).toBe(200);
    expect((await request(app).post(`${base()}/audit`).set(guest.auth)).status).toBe(403);
  });

  it("answers 404 for a page of another site and 400 for an unknown kind", async () => {
    expect((await request(app).get(`${base()}/audit/pages/00000000-0000-4000-8000-000000000000?from=2026-11-01&to=2026-11-06`).set(auth)).status).toBe(404);
    expect((await request(app).get(`${base()}/audit/pages?kind=SLOW`).set(auth)).status).toBe(400);
  });
});
