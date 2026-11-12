import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { createContainer } from "../../src/composition/create-container.js";
import { createRoutes, ROUTE_MOUNTS } from "../../src/composition/create-routes.js";
import { SHARED_READS, sharedPath } from "../../src/composition/shared-routes.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { putObject } from "../../src/shared/infrastructure/storage.js";
import { PrismaCheckJobs } from "../../src/modules/seo/infrastructure/prisma-check-jobs.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs, signInAsOutsider } from "../helpers/auth.js";

const app = createApp({ sharedReads: { perAddress: 100_000, platformCallsPerLink: 100_000 } });
const png = Buffer.from("89504e470d0a1a0a", "hex");
const RANGE = "from=2026-11-01&to=2026-11-07";

type Auth = { Authorization: string };

interface Seeded {
  projectId: string;
  campaignId: string;
  adSetId: string;
  adId: string;
  fileId: string;
  posterId: string;
  siteId: string;
}

let admin: Auth;
let token: string;
let shared: Seeded;
let other: Seeded;

async function seedSharedProject(name: string): Promise<Seeded> {
  const { projectId } = await seedProject("owner", name);
  const campaign = await seedCampaign(projectId, `${name} campaign`, "META");
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { sourceAccountId: "act_1", kpiMetric: "CPC", kpiTarget: "5" },
  });
  await prisma.campaignDailyMetric.create({
    data: { campaignId: campaign.id, date: new Date("2026-11-02T00:00:00Z"), spend: "12.5", impressions: 400, clicks: 20, results: 3 },
  });
  const adSet = await prisma.adSet.create({ data: { campaignId: campaign.id, name: "Группа", position: 0 } });
  const ad = await prisma.ad.create({ data: { adSetId: adSet.id, name: "Объявление", position: 0, externalId: "ad-1" } });
  const file = await prisma.adCreative.create({ data: {
    adId: ad.id, externalId: "c1", position: 0, kind: "IMAGE", title: "Заголовок", body: "Текст",
    fileKey: "creatives/shared-file", contentType: "image/png", bytes: png.length,
  } });
  const poster = await prisma.adCreative.create({ data: {
    adId: ad.id, externalId: "c2", position: 1, kind: "VIDEO",
    posterKey: "creatives/shared-file", posterContentType: "image/png",
  } });
  const site = await prisma.seoSite.create({ data: {
    projectId, siteUrl: `https://${name.toLowerCase()}.ru/`, encryptedToken: "sealed", revision: "v1", status: "SUCCESS",
    nextDailyAt: new Date(), nextCheckAt: new Date("2026-12-01"), checkStatus: "SUCCESS",
  } });
  await prisma.seoDay.create({ data: { siteId: site.id, date: new Date("2026-11-02T00:00:00Z"), clicks: 4, impressions: 100, position: 2 } });
  return {
    projectId, campaignId: campaign.id, adSetId: adSet.id, adId: ad.id,
    fileId: file.id, posterId: poster.id, siteId: site.id,
  };
}

async function checkSite(siteId: string) {
  const checks = new PrismaCheckJobs(prisma);
  const now = new Date("2026-11-07T06:00:00Z");
  await prisma.seoSite.update({ where: { id: siteId }, data: { checkQueuedAt: now } });
  const job = (await checks.claim(now))!;
  const url = "https://acme.ru/";
  await checks.complete(job, {
    pages: [{
      url, inSitemap: true, hasImpressions: true, outcome: "FETCHED", status: 200, finalUrl: url,
      contentType: "text/html", responseMs: 80, facts: null,
    }],
    problems: new Map([[url, ["DESCRIPTION_MISSING"]]]) as never,
    notChecked: 0,
    labs: [],
  }, now);
}

const at = (link: string, path: string) => `/api/shared/${link}${path}`;
const viaLink = (path: string, link = token) => request(app).get(at(link, path));
const asAdmin = (path: string) => request(app).get(`/api${path}`).set(admin);

async function concreteReads(seeded: Seeded): Promise<Map<string, string>> {
  const { projectId: p, campaignId: c, adSetId, adId, fileId, posterId, siteId: s } = seeded;
  const pages = await asAdmin(`/projects/${p}/seo/sites/${s}/audit/pages`);
  const pageId = (pages.body as { id: string }[])[0]?.id ?? "missing";
  return new Map([
    ["/projects/:projectId/summary", `/projects/${p}/summary?${RANGE}`],
    ["/projects/:projectId/campaigns", `/projects/${p}/campaigns?${RANGE}`],
    ["/projects/:id/kpis", `/projects/${p}/kpis`],
    ["/campaigns/:id/kpi", `/campaigns/${c}/kpi`],
    ["/projects/:id/summary-tiles", `/projects/${p}/summary-tiles`],
    ["/crm/boards/:boardKey/stage-counts", `/crm/boards/${p}/stage-counts?${RANGE}`],
    ["/projects/:id/seo/sites", `/projects/${p}/seo/sites`],
    ["/projects/:id/seo/sites/:siteId/traffic", `/projects/${p}/seo/sites/${s}/traffic?${RANGE}`],
    ["/projects/:id/seo/sites/:siteId/search", `/projects/${p}/seo/sites/${s}/search?${RANGE}`],
    ["/projects/:id/seo/sites/:siteId/top", `/projects/${p}/seo/sites/${s}/top?${RANGE}&kind=query`],
    ["/projects/:id/seo/sites/:siteId/vitals", `/projects/${p}/seo/sites/${s}/vitals?${RANGE}`],
    ["/projects/:id/seo/sites/:siteId/audit", `/projects/${p}/seo/sites/${s}/audit`],
    ["/projects/:id/seo/sites/:siteId/audit/pages", `/projects/${p}/seo/sites/${s}/audit/pages`],
    ["/projects/:id/seo/sites/:siteId/audit/pages/:pageId", `/projects/${p}/seo/sites/${s}/audit/pages/${pageId}?${RANGE}`],
    ["/campaigns/:id", `/campaigns/${c}?${RANGE}`],
    ["/campaigns/:id/daily", `/campaigns/${c}/daily?${RANGE}`],
    ["/campaigns/:id/ad-sets", `/campaigns/${c}/ad-sets?${RANGE}`],
    ["/ad-sets/:id/ads", `/ad-sets/${adSetId}/ads?${RANGE}`],
    ["/ad-creatives/:id/file", `/ad-creatives/${fileId}/file`],
    ["/ad-creatives/:id/poster", `/ad-creatives/${posterId}/poster`],
    ["/ads/:id/preview", `/ads/${adId}/preview`],
    ["/ads/:id/creatives", `/ads/${adId}/creatives`],
  ]);
}

beforeEach(async () => {
  await resetDb();
  await prisma.projectShareLink.deleteMany();
  await putObject("creatives/shared-file", png, "image/png");
  admin = (await signInAs("Admin", { role: "ADMIN" })).auth;
  shared = await seedSharedProject("Acme");
  other = await seedSharedProject("Other");
  await checkSite(shared.siteId);
  token = (await request(app).put(`/api/projects/${shared.projectId}/share-link`).set(admin).send({})).body.token;
});
afterAll(() => prisma.$disconnect());

describe("opening a share link", () => {
  it("names the shared project and the modules its page uses, without a session", async () => {
    const res = await viaLink("");

    expect(res.status).toBe(200);
    expect(res.body.project).toMatchObject({ id: shared.projectId, name: "Acme" });
    expect(res.body.modules).toEqual(["DASHBOARD", "PROJECTS", "CRM"]);
  });

  it("leaves CRM out when the organization's tariff has no CRM, and refuses its stage counts", async () => {
    await prisma.organization.update({ where: { id: (await currentOrg()).id }, data: { tariff: "SOLO" } });

    expect((await viaLink("")).body.modules).toEqual(["DASHBOARD", "PROJECTS"]);
    expect((await viaLink(`/crm/boards/${shared.projectId}/stage-counts?${RANGE}`)).status).toBe(404);
  });

  it("tells search engines to keep away, also when the link is dead", async () => {
    expect((await viaLink("")).headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect((await viaLink("", "x".repeat(43))).headers["x-robots-tag"]).toBe("noindex, nofollow");
  });

  it("shows the same project to a visitor signed in to another organization", async () => {
    const outsider = await signInAsOutsider();

    const res = await request(app).get(at(token, "")).set(outsider.auth);

    expect(res.status).toBe(200);
    expect(res.body.project.id).toBe(shared.projectId);
    expect((await request(app).get(at(token, "/members")).set(outsider.auth)).status).toBe(404);
  });
});

describe("the reads a share link serves", () => {
  it("answer each read of the shared page exactly as they answer an admin", async () => {
    const reads = await concreteReads(shared);
    for (const read of SHARED_READS) {
      const path = reads.get(sharedPath(read));
      expect(path, `a concrete request for ${sharedPath(read)}`).toBeDefined();
      const [member, visitor] = await Promise.all([asAdmin(path!), viaLink(path!)]);

      if (read.source !== "ad-previews" || !path!.endsWith("/preview")) {
        expect(member.status, `admin ${path}`).toBe(200);
      }
      expect(visitor.status, path).toBe(member.status);
      expect(visitor.body, path).toEqual(member.body);
    }
  });

  it("serve no read of another project in the same organization", async () => {
    const reads = await concreteReads(other);
    for (const read of SHARED_READS) {
      const path = reads.get(sharedPath(read))!;
      expect((await viaLink(path)).status, path).toBe(404);
    }
  });

  it("refuse every method but GET, and change nothing", async () => {
    const { projectId: p, campaignId: c, siteId: s } = shared;
    const writes = [
      request(app).put(at(token, `/projects/${p}/summary-tiles`)).send({ tiles: ["SPEND"] }),
      request(app).put(at(token, `/campaigns/${c}/kpi`)).send({ metric: "CPM", target: "1" }),
      request(app).delete(at(token, `/campaigns/${c}/kpi`)),
      request(app).post(at(token, `/projects/${p}/seo/sites/${s}/audit`)),
      request(app).patch(at(token, `/projects/${p}`)).send({ name: "Взлом" }),
      request(app).delete(at(token, `/projects/${p}/share-link`)),
    ];

    for (const write of writes) expect((await write).status).toBe(404);
    expect((await prisma.project.findUniqueOrThrow({ where: { id: p } })).summaryTiles).toEqual([]);
    expect((await prisma.campaign.findUniqueOrThrow({ where: { id: c } })).kpiMetric).toBe("CPC");
    expect((await prisma.project.findUniqueOrThrow({ where: { id: p } })).name).toBe("Acme");
    expect(await prisma.projectShareLink.count()).toBe(1);
  });

  it("refuse every other GET the API serves, among them members, tasks, leads and contacts", async () => {
    interface Layer {
      readonly handle?: { readonly stack?: readonly Layer[] };
      readonly route?: { readonly path: string; readonly methods: Record<string, boolean> };
    }
    const allowed = new Set(SHARED_READS.map(sharedPath));
    const stack = (createRoutes(createContainer()) as unknown as { stack: Layer[] }).stack;
    const gets = stack.flatMap((layer, index) => {
      const mount = ROUTE_MOUNTS[index].path;
      if (mount.startsWith("/api/shared") || !mount.startsWith("/api")) return [];
      return (layer.handle?.stack ?? []).flatMap((inner) =>
        inner.route?.methods.get ? [`${mount.slice("/api".length)}/${inner.route.path}`.replace(/\/{2,}/g, "/").replace(/(.)\/$/, "$1")] : []);
    });
    const refused = [...new Set(gets)].filter((path) => !allowed.has(path));
    expect(refused).toEqual(expect.arrayContaining(["/members", "/tasks", "/crm/boards/:boardKey/leads", "/crm/clients/:clientId/people"]));

    for (const pattern of refused) {
      const path = pattern.replace(/[:*][A-Za-z0-9_]+/g, shared.projectId);
      const res = await viaLink(path);
      expect(res.status, pattern).toBe(404);
    }
  });
});

describe("a dead link", () => {
  const expectDead = async (link: string) => {
    for (const path of ["", `/projects/${shared.projectId}/campaigns?${RANGE}`]) {
      const res = await viaLink(path, link);
      expect(res.status, path).toBe(404);
      expect(res.body.error.message).toBe("Shared link not found");
    }
  };

  it("is a token that was replaced", async () => {
    await request(app).put(`/api/projects/${shared.projectId}/share-link`).set(admin).send({ renew: true });

    await expectDead(token);
  });

  it("is a link that was switched off", async () => {
    await request(app).delete(`/api/projects/${shared.projectId}/share-link`).set(admin);

    await expectDead(token);
  });

  it("is a token nobody issued, well formed or not", async () => {
    await expectDead("A".repeat(43));
    await expectDead("short");
  });

  it("is the link of a suspended organization", async () => {
    await prisma.organization.update({ where: { id: (await currentOrg()).id }, data: { status: "SUSPENDED" } });

    await expectDead(token);
  });

  it("is the link of a deleted project", async () => {
    await request(app).delete(`/api/projects/${shared.projectId}`).set(admin);

    await expectDead(token);
  });
});

describe("the limits on shared reads", () => {
  it("answer 429 once one address sends more requests in a minute than allowed", async () => {
    const limited = createApp({ sharedReads: { perAddress: 3, platformCallsPerLink: 100 } });
    for (let sent = 0; sent < 3; sent += 1) expect((await request(limited).get(at(token, ""))).status).toBe(200);

    const refused = await request(limited).get(at(token, ""));

    expect(refused.status).toBe(429);
    expect(refused.headers["retry-after"]).toBeDefined();
  });

  it("allow a link fewer reads that may call the platform, ad previews and creatives together, than other reads", async () => {
    const limited = createApp({ sharedReads: { perAddress: 100, platformCallsPerLink: 2 } });
    expect((await request(limited).get(at(token, `/ads/${shared.adId}/preview`))).status).not.toBe(429);
    expect((await request(limited).get(at(token, `/ads/${shared.adId}/creatives`))).status).toBe(200);

    expect((await request(limited).get(at(token, `/ads/${shared.adId}/preview`))).status).toBe(429);
    expect((await request(limited).get(at(token, `/ads/${shared.adId}/creatives`))).status).toBe(429);
    expect((await request(limited).get(at(token, `/campaigns/${shared.campaignId}?${RANGE}`))).status).toBe(200);
  });
});
