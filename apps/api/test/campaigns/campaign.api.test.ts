import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { signInAs, signInAsOutsider } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";
const RANGE = "?from=2026-08-01&to=2026-08-03";

let auth: { Authorization: string };
let projectId: string;
let campaignId: string;

beforeEach(async () => {
  await resetDb();
  const admin = await signInAs();
  auth = admin.auth;
  ({ projectId } = await seedProject(admin.user.id));
  campaignId = (await seedCampaign(projectId, "Поиск / Москва", "YANDEX")).id;
  await prisma.campaignDailyMetric.create({
    data: {
      campaignId, date: new Date("2026-08-02T00:00:00.000Z"),
      spend: 1000, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50, revenue: 4000,
    },
  });
});
afterAll(async () => { await prisma.$disconnect(); });

/** A campaign in a *different* organization. `seedProject` always builds inside
 * the migration's one, so the tenancy boundary needs its own fixture. */
async function foreignCampaign() {
  const outsider = await signInAsOutsider();
  const project = await prisma.project.create({
    data: { clientId: outsider.client.id, name: "Их проект", position: 0 },
  });
  return prisma.campaign.create({
    data: { projectId: project.id, name: "Их", channel: "META", position: 0 },
  });
}

describe("GET /api/campaigns/:id", () => {
  it("returns the campaign with the range's figures and derived ratios", async () => {
    const res = await request(app).get(`/api/campaigns/${campaignId}${RANGE}`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Поиск / Москва", channel: "YANDEX", status: "ACTIVE" });
    expect(res.body.performance).toMatchObject({
      spend: 1000, clicks: 2000, ctr: 2, cpc: 0.5, cpm: 10, cpa: 20, roas: 4, frequency: 2.5,
    });
  });

  // Absent, not zero: no click was measured, so there is no cost per click.
  it("reports a ratio with no divisor as null", async () => {
    const empty = await seedCampaign(projectId, "Без данных", "META");
    const res = await request(app).get(`/api/campaigns/${empty.id}${RANGE}`).set(auth);

    expect(res.body.performance).toMatchObject({ spend: 0, cpc: null, ctr: null, roas: null });
  });

  it("counts only the days inside the range", async () => {
    await prisma.campaignDailyMetric.create({
      data: { campaignId, date: new Date("2026-09-01T00:00:00.000Z"), spend: 9999 },
    });
    const res = await request(app).get(`/api/campaigns/${campaignId}${RANGE}`).set(auth);
    expect(res.body.performance.spend).toBe(1000);
  });

  it("404s for a campaign in another organization", async () => {
    const theirs = await foreignCampaign();
    const res = await request(app).get(`/api/campaigns/${theirs.id}${RANGE}`).set(auth);
    expect(res.status).toBe(404);
  });

  it("404s for a campaign that does not exist", async () => {
    expect((await request(app).get(`/api/campaigns/${MISSING}${RANGE}`).set(auth)).status).toBe(404);
  });

  it("requires authentication", async () => {
    expect((await request(app).get(`/api/campaigns/${campaignId}${RANGE}`)).status).toBe(401);
  });

  it("400s on a range that ends before it starts", async () => {
    const res = await request(app)
      .get(`/api/campaigns/${campaignId}?from=2026-08-05&to=2026-08-01`).set(auth);
    expect(res.status).toBe(400);
  });

  it("400s when the range is missing", async () => {
    expect((await request(app).get(`/api/campaigns/${campaignId}`).set(auth)).status).toBe(400);
  });
});

describe("GET /api/projects/:projectId/campaigns", () => {
  it("lists the project's campaigns with their figures", async () => {
    await seedCampaign(projectId, "Второй", "META");
    const res = await request(app).get(`/api/projects/${projectId}/campaigns${RANGE}`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ name: "Поиск / Москва", performance: { spend: 1000 } });
  });

  it("404s for a project out of reach", async () => {
    const theirs = await foreignCampaign();
    const res = await request(app).get(`/api/projects/${theirs.projectId}/campaigns${RANGE}`).set(auth);
    expect(res.status).toBe(404);
  });
});

describe("the levels beneath a campaign", () => {
  it("lists ad sets and then the ads inside one", async () => {
    const adSet = await prisma.adSet.create({
      data: { campaignId, name: "Москва · 28–55", audience: "Гео Москва", position: 0 },
    });
    await prisma.ad.create({
      data: { adSetId: adSet.id, name: "Приём сегодня", format: "Текст", position: 0 },
    });
    await prisma.adSetDailyMetric.create({
      data: { adSetId: adSet.id, date: new Date("2026-08-02T00:00:00.000Z"), spend: 600, clicks: 1200 },
    });

    const sets = await request(app).get(`/api/campaigns/${campaignId}/ad-sets${RANGE}`).set(auth);
    expect(sets.status).toBe(200);
    expect(sets.body[0]).toMatchObject({ name: "Москва · 28–55", performance: { spend: 600, cpc: 0.5 } });

    const ads = await request(app).get(`/api/ad-sets/${adSet.id}/ads${RANGE}`).set(auth);
    expect(ads.status).toBe(200);
    expect(ads.body[0]).toMatchObject({ name: "Приём сегодня", format: "Текст" });
  });

  it("404s for an ad set under a campaign out of reach", async () => {
    const theirs = await foreignCampaign();
    const theirSet = await prisma.adSet.create({
      data: { campaignId: theirs.id, name: "Их группа", position: 0 },
    });

    expect((await request(app).get(`/api/ad-sets/${theirSet.id}/ads${RANGE}`).set(auth)).status).toBe(404);
  });
});

describe("the daily series", () => {
  it("returns a campaign's days, each named by its calendar date", async () => {
    await prisma.campaignDailyMetric.create({
      data: { campaignId, date: new Date("2026-08-01T00:00:00.000Z"), spend: 400, clicks: 800 },
    });

    const res = await request(app).get(`/api/campaigns/${campaignId}/daily${RANGE}`).set(auth);

    expect(res.status).toBe(200);
    // A calendar day, not a timestamp: the buyer picked a day and the chart
    // labels one, so a UTC instant would only invite a zone to shift it.
    expect(res.body).toEqual([
      expect.objectContaining({ date: "2026-08-01", spend: 400, clicks: 800 }),
      expect.objectContaining({ date: "2026-08-02", spend: 1000 }),
    ]);
  });

  it("adds a project's campaigns together per date", async () => {
    const second = await seedCampaign(projectId, "Второй", "META");
    await prisma.campaignDailyMetric.create({
      data: { campaignId: second.id, date: new Date("2026-08-02T00:00:00.000Z"), spend: 500 },
    });

    const res = await request(app).get(`/api/projects/${projectId}/daily${RANGE}`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ date: "2026-08-02", spend: 1500 })]);
  });

  it("404s a project series out of reach", async () => {
    const theirs = await foreignCampaign();
    expect((await request(app).get(`/api/projects/${theirs.projectId}/daily${RANGE}`).set(auth)).status)
      .toBe(404);
  });
});

describe("summaries", () => {
  it("sums a project from its campaigns", async () => {
    const second = await seedCampaign(projectId, "Второй", "META");
    await prisma.campaignDailyMetric.create({
      data: { campaignId: second.id, date: new Date("2026-08-02T00:00:00.000Z"), spend: 500, conversions: 10 },
    });

    const res = await request(app).get(`/api/projects/${projectId}/summary${RANGE}`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ spend: 1500, conversions: 60, cpa: 25 });
  });

  it("sums the agency from the projects the member reaches", async () => {
    const res = await request(app).get(`/api/summary${RANGE}`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.spend).toBe(1000);
  });

  it("splits the agency by channel, biggest spend first", async () => {
    const meta = await seedCampaign(projectId, "Лента", "META");
    await prisma.campaignDailyMetric.create({
      data: { campaignId: meta.id, date: new Date("2026-08-02T00:00:00.000Z"), spend: 3000 },
    });

    const res = await request(app).get(`/api/summary/channels${RANGE}`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { channel: "META", campaigns: 1, performance: expect.objectContaining({ spend: 3000 }) },
      { channel: "YANDEX", campaigns: 1, performance: expect.objectContaining({ spend: 1000 }) },
    ]);
  });

  it("leaves out a project the member holds no grant over", async () => {
    const manager = await signInAs("Manager", { role: "MANAGER" });
    const res = await request(app).get(`/api/summary${RANGE}`).set(manager.auth);
    expect(res.body.spend).toBe(0);
  });
});

describe("the sheet is gone", () => {
  const addresses = [
    ["properties", "/api/campaigns/CID/properties"],
    ["a property", `/api/properties/${MISSING}`],
    ["property values", `/api/records/${MISSING}/values`],
    ["records", "/api/campaigns/CID/records"],
    ["a record", `/api/records/${MISSING}`],
  ] as const;
  const roles = ["ADMIN", "MANAGER", "GUEST", "CLIENT"] as const;

  // Every role, not only the one that used to be allowed: a removed address
  // must be absent, not merely refused, so nothing can be inferred from the
  // difference between 403 and 404.
  it.each(roles.flatMap((role) => addresses.map(([name, path]) => [role, name, path] as const)))(
    "answers 404 to a %s asking for %s",
    async (role, _name, path) => {
      const { auth: theirs } = await signInAs(`A ${role}`, { role });
      const res = await request(app).get(path.replace("CID", campaignId)).set(theirs);
      expect(res.status).toBe(404);
    },
  );
});
