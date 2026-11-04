import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { currentOrg, grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";

const app = createApp();

let auth: { Authorization: string };
let orgId: string;
let clientId: string;
let projectId: string;
let campaignId: string;
let moscowId: string;
let firstAdId: string;
let secondAdId: string;

beforeEach(async () => {
  await resetDb();
  const admin = await signInAs();
  auth = admin.auth;
  orgId = (await currentOrg()).id;
  ({ clientId, projectId } = await seedProject(admin.user.id, "Ромашка"));
  campaignId = (await seedCampaign(projectId, "Весна", "META")).id;
  moscowId = (await prisma.adSet.create({ data: { campaignId, name: "Москва", position: 0 } })).id;
  firstAdId = (await prisma.ad.create({ data: { adSetId: moscowId, name: "Видео 1", position: 0 } })).id;
  secondAdId = (await prisma.ad.create({ data: { adSetId: moscowId, name: "Видео 2", position: 1 } })).id;
});

afterAll(() => prisma.$disconnect());

const SEPTEMBER = "from=2026-09-01&to=2026-09-30";
const counts = (query = SEPTEMBER, as = auth, board = projectId) =>
  request(app).get(`/api/crm/boards/${board}/stage-counts?${query}`).set(as);

type Seed = {
  stage?: "NEW" | "QUALIFIED" | "TARGET" | "PROPOSAL" | null;
  project?: string;
  campaign?: string | null;
  ad?: string | null;
  createdAt?: string;
  submittedAt?: string;
  columnId?: string;
};

let seeded = 0;
function seedLead({ stage = "NEW", project = projectId, campaign = campaignId, ad = null, createdAt = "2026-09-10T12:00:00Z", submittedAt, columnId }: Seed = {}) {
  seeded += 1;
  return prisma.lead.create({
    data: {
      name: `Лид ${seeded}`, orgId, projectId: project, campaignId: campaign, adId: ad, stage, columnId,
      createdAt: new Date(createdAt),
      ...(submittedAt ? {
        origin: "META" as const,
        metaSource: {
          create: {
            accountId: "123", formId: "f1", campaignExternalId: "c1", campaignName: "Весна",
            adSetExternalId: "s1", adSetName: "Москва", adExternalId: "555", adName: "Видео 1",
            submittedAt: new Date(submittedAt), answers: [],
          },
        },
      } : {}),
    },
  });
}

const ZERO = { NEW: 0, QUALIFIED: 0, TARGET: 0, PROPOSAL: 0 };

describe("period lead counts per campaign, ad set and ad", () => {
  it("groups the board's leads by campaign, by the ad set of their ad and by ad", async () => {
    await seedLead({ stage: "TARGET", ad: firstAdId });
    await seedLead({ stage: "QUALIFIED", ad: secondAdId });
    await seedLead({ stage: "NEW", ad: null });

    const response = await counts();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      campaigns: [{ campaignId, ...ZERO, NEW: 1, QUALIFIED: 1, TARGET: 1 }],
      adSets: [{ adSetId: moscowId, ...ZERO, QUALIFIED: 1, TARGET: 1 }],
      ads: [
        { adId: firstAdId, ...ZERO, TARGET: 1 },
        { adId: secondAdId, ...ZERO, QUALIFIED: 1 },
      ].sort((a, b) => a.adId.localeCompare(b.adId)),
    });
  });

  it("counts a lead by the stage it is in now", async () => {
    const lead = await seedLead({ ad: firstAdId });
    await request(app).patch(`/api/crm/boards/${projectId}/leads/${lead.id}/move`).set(auth)
      .send({ stage: "PROPOSAL", position: 0 }).expect(200);

    expect((await counts()).body.ads).toEqual([{ adId: firstAdId, ...ZERO, PROPOSAL: 1 }]);
  });

  it("counts a lead created by hand nowhere", async () => {
    const created = await request(app).post(`/api/crm/boards/${projectId}/leads`).set(auth).send({ name: "Звонок" }).expect(201);
    await request(app).patch(`/api/crm/boards/${projectId}/leads/${created.body.id}/move`).set(auth)
      .send({ stage: "PROPOSAL", position: 0 }).expect(200);

    expect((await counts()).body).toEqual({ campaigns: [], adSets: [], ads: [] });
  });

  it("leaves out leads in custom columns", async () => {
    const column = await prisma.leadColumn.create({ data: { orgId, projectId, name: "Встреча", position: 0 } });
    await seedLead({ stage: null, columnId: column.id, ad: firstAdId });

    expect((await counts()).body).toEqual({ campaigns: [], adSets: [], ads: [] });
  });

  it("includes both ends of the range as whole UTC days and nothing beyond them", async () => {
    await seedLead({ createdAt: "2026-08-31T23:59:59Z" });
    await seedLead({ createdAt: "2026-09-01T00:00:00Z" });
    await seedLead({ createdAt: "2026-09-30T23:59:59Z" });
    await seedLead({ createdAt: "2026-10-01T00:00:00Z" });

    expect((await counts()).body.campaigns).toEqual([{ campaignId, ...ZERO, NEW: 2 }]);
  });

  it("counts a Meta lead by when its form was submitted, not when it was imported", async () => {
    await seedLead({ stage: "QUALIFIED", createdAt: "2026-10-01T08:00:00Z", submittedAt: "2026-09-30T22:00:00Z" });
    await seedLead({ stage: "QUALIFIED", createdAt: "2026-09-02T08:00:00Z", submittedAt: "2026-08-31T22:00:00Z" });

    expect((await counts()).body.campaigns).toEqual([{ campaignId, ...ZERO, QUALIFIED: 1 }]);
  });

  it("counts only the board's own project", async () => {
    const other = await prisma.project.create({ data: { clientId, name: "Василёк", position: 1 } });
    const otherCampaign = await seedCampaign(other.id, "Осень", "META");
    await seedLead({ project: other.id, campaign: otherCampaign.id });

    expect((await counts()).body).toEqual({ campaigns: [], adSets: [], ads: [] });
    expect((await counts(SEPTEMBER, auth, other.id)).body.campaigns).toEqual([{ campaignId: otherCampaign.id, ...ZERO, NEW: 1 }]);
  });

  it("answers 404 for a board the member cannot reach", async () => {
    const other = await prisma.project.create({ data: { clientId, name: "Василёк", position: 1 } });
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId, projectId);
    const outsider = await signInAsOutsider();

    expect((await counts(SEPTEMBER, manager.auth)).status).toBe(200);
    expect((await counts(SEPTEMBER, manager.auth, other.id)).status).toBe(404);
    expect((await counts(SEPTEMBER, outsider.auth)).status).toBe(404);
  });

  it("answers 404 while the organization's CRM module is off", async () => {
    await prisma.organization.update({ where: { id: orgId }, data: { modules: ["TASKS", "REPORTS"] } });

    expect((await counts()).status).toBe(404);
  });

  it("carries ids and counts only", async () => {
    await seedLead({ ad: firstAdId });

    const body = (await counts()).body;

    expect(Object.keys(body.campaigns[0]).sort()).toEqual(["NEW", "PROPOSAL", "QUALIFIED", "TARGET", "campaignId"]);
    expect(Object.keys(body.adSets[0]).sort()).toEqual(["NEW", "PROPOSAL", "QUALIFIED", "TARGET", "adSetId"]);
    expect(Object.keys(body.ads[0]).sort()).toEqual(["NEW", "PROPOSAL", "QUALIFIED", "TARGET", "adId"]);
  });

  it.each([
    ["a missing start", "to=2026-09-30"],
    ["a malformed day", "from=2026-9-01&to=2026-09-30"],
    ["a reversed range", "from=2026-09-30&to=2026-09-01"],
  ])("refuses %s", async (_, query) => {
    expect((await counts(query)).status).toBe(400);
  });

  it("requires a signed-in member", async () => {
    expect((await request(app).get(`/api/crm/boards/${projectId}/stage-counts?${SEPTEMBER}`)).status).toBe(401);
  });

  it("is documented", async () => {
    const doc = (await request(app).get("/api/openapi.json")).body;

    expect(doc.paths["/api/crm/boards/{boardKey}/stage-counts"]).toHaveProperty("get");
  });
});
