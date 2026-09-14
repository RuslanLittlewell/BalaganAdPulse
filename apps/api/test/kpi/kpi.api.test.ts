import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { currentOrg, grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";

const app = createApp();
let admin: { Authorization: string };
let clientId: string;
let projectId: string;
let campaignId: string;

const projectKpi = (id = projectId) => `/api/projects/${id}/kpi`;
const campaignKpi = (id = campaignId) => `/api/campaigns/${id}/kpi`;
const organizationKpi = "/api/organization/kpi";

beforeEach(async () => {
  await resetDb();
  const member = await signInAs();
  admin = member.auth;
  ({ clientId, projectId } = await seedProject(member.user.id));
  campaignId = (await seedCampaign(projectId)).id;
});

afterAll(() => prisma.$disconnect());

describe("setting, reading and clearing a KPI", () => {
  it.each([
    ["project", () => projectKpi()],
    ["campaign", () => campaignKpi()],
    ["organization", () => organizationKpi],
  ])("keeps one %s KPI, replaced by the next and gone once cleared", async (_level, path) => {
    const first = await request(app).put(path()).set(admin).send({ metric: "CONVERSIONS", target: "50" });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ metric: "CONVERSIONS", target: "50.0000", updatedAt: expect.any(String) });
    expect((await request(app).get(path()).set(admin)).body).toMatchObject({ metric: "CONVERSIONS", target: "50.0000" });

    await request(app).put(path()).set(admin).send({ metric: "CPA", target: "20.5" });
    expect((await request(app).get(path()).set(admin)).body).toMatchObject({ metric: "CPA", target: "20.5000" });

    expect((await request(app).delete(path()).set(admin)).status).toBe(204);
    const cleared = await request(app).get(path()).set(admin);
    expect(cleared.status).toBe(200);
    expect(cleared.body).toBeNull();
  });

  it("keeps the levels independent", async () => {
    await request(app).put(projectKpi()).set(admin).send({ metric: "SPEND", target: "1000" });

    await request(app).put(campaignKpi()).set(admin).send({ metric: "CTR", target: "2.5" });
    await request(app).put(organizationKpi).set(admin).send({ metric: "ROAS", target: "3" });
    await request(app).delete(campaignKpi()).set(admin);

    expect((await request(app).get(projectKpi()).set(admin)).body).toMatchObject({ metric: "SPEND", target: "1000.0000" });
    expect((await request(app).get(organizationKpi).set(admin)).body).toMatchObject({ metric: "ROAS", target: "3.0000" });
    expect((await request(app).get(campaignKpi()).set(admin)).body).toBeNull();
  });

  it.each([
    { metric: "LIKES", target: "10" },
    { metric: "CONVERSIONS", target: "0" },
    { metric: "CONVERSIONS", target: "-5" },
    { metric: "CONVERSIONS", target: "ten" },
    { metric: "CONVERSIONS", target: "123456789012345" },
    { metric: "CONVERSIONS", target: "1.23456" },
    { metric: "CONVERSIONS", target: 50 },
    { metric: "CONVERSIONS" },
    { metric: "CONVERSIONS", target: "50", extra: true },
  ])("refuses %j and leaves the KPI unchanged", async (body) => {
    await request(app).put(projectKpi()).set(admin).send({ metric: "SPEND", target: "1000" });

    expect((await request(app).put(projectKpi()).set(admin).send(body)).status).toBe(400);
    expect((await request(app).get(projectKpi()).set(admin)).body).toMatchObject({ metric: "SPEND", target: "1000.0000" });
  });
});

describe("who reaches and changes a KPI", () => {
  it("answers 404 for projects and campaigns out of reach", async () => {
    const stranger = await signInAs("Stranger", { role: "MANAGER" });
    const outsider = await signInAsOutsider();
    const theirs = await prisma.project.create({ data: { clientId: outsider.client.id, name: "Theirs", position: 0 } });

    for (const path of [projectKpi(), campaignKpi()]) {
      expect((await request(app).get(path).set(stranger.auth)).status).toBe(404);
      expect((await request(app).put(path).set(stranger.auth).send({ metric: "CONVERSIONS", target: "5" })).status).toBe(404);
    }
    expect((await request(app).get(projectKpi(theirs.id)).set(admin)).status).toBe(404);
    expect((await request(app).get(campaignKpi("00000000-0000-4000-8000-000000000000")).set(admin)).status).toBe(404);
  });

  it("lets readers of a project read its KPIs and only staff change them", async () => {
    await request(app).put(projectKpi()).set(admin).send({ metric: "CONVERSIONS", target: "50" });
    const client = await signInAs("Client", { role: "CLIENT" });
    await grantAccess(client.membership!.id, clientId);
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId);

    for (const reader of [client, guest]) {
      expect((await request(app).get(projectKpi()).set(reader.auth)).body).toMatchObject({ metric: "CONVERSIONS" });
      expect((await request(app).put(projectKpi()).set(reader.auth).send({ metric: "CPA", target: "10" })).status).toBe(403);
      expect((await request(app).put(campaignKpi()).set(reader.auth).send({ metric: "CPA", target: "10" })).status).toBe(403);
      expect((await request(app).delete(projectKpi()).set(reader.auth)).status).toBe(403);
    }
    expect((await request(app).put(projectKpi()).set(manager.auth).send({ metric: "CPA", target: "10" })).status).toBe(200);
    expect((await request(app).put(campaignKpi()).set(manager.auth).send({ metric: "CPC", target: "1" })).status).toBe(200);
  });

  it("keeps the organization KPI to admins", async () => {
    for (const role of ["MANAGER", "GUEST", "CLIENT", "CLIENT_ADMIN"] as const) {
      const member = await signInAs(role, { role });
      expect((await request(app).get(organizationKpi).set(member.auth)).status).toBe(403);
      expect((await request(app).put(organizationKpi).set(member.auth).send({ metric: "SPEND", target: "1" })).status).toBe(403);
      expect((await request(app).delete(organizationKpi).set(member.auth)).status).toBe(403);
    }
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: (await currentOrg()).id } })).kpiMetric).toBeNull();
  });

  it("refuses requests without a session", async () => {
    expect((await request(app).get(projectKpi())).status).toBe(401);
    expect((await request(app).put(organizationKpi).send({ metric: "SPEND", target: "1" })).status).toBe(401);
  });
});

describe("auditing KPI changes", () => {
  it("records the level, the metric and the target before and after", async () => {
    await request(app).put(campaignKpi()).set(admin).send({ metric: "CPA", target: "20" });
    await request(app).put(campaignKpi()).set(admin).send({ metric: "CPA", target: "15" });
    await request(app).delete(campaignKpi()).set(admin);
    await request(app).put(organizationKpi).set(admin).send({ metric: "SPEND", target: "5000" });

    const events = await prisma.auditEvent.findMany({ orderBy: { createdAt: "asc" } });
    expect(events.map((event) => [event.entityType, event.action, event.changes])).toEqual([
      ["campaign", "UPDATE", { before: null, after: { metric: "CPA", target: "20.0000" } }],
      ["campaign", "UPDATE", { before: { metric: "CPA", target: "20.0000" }, after: { metric: "CPA", target: "15.0000" } }],
      ["campaign", "UPDATE", { before: { metric: "CPA", target: "15.0000" }, after: null }],
      ["organization", "UPDATE", { before: null, after: { metric: "SPEND", target: "5000.0000" } }],
    ]);
    expect(events[0]).toMatchObject({ entityId: campaignId, campaignId, projectId, clientId });
  });

  it("records nothing for a refused change", async () => {
    await request(app).put(projectKpi()).set(admin).send({ metric: "LIKES", target: "1" });

    expect(await prisma.auditEvent.count()).toBe(0);
  });
});
