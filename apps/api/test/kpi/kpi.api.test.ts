import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { currentOrg, grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";
import { BUSINESS_EVENTS } from "../helpers/audit.js";

const app = createApp();
let admin: { Authorization: string };
let clientId: string;
let projectId: string;
let campaignId: string;

const projectKpis = (id = projectId) => `/api/projects/${id}/kpis`;
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

  it.each(["RESULTS", "COST_PER_RESULT"])("accepts %s as a metric", async (metric) => {
    const res = await request(app).put(campaignKpi()).set(admin).send({ metric, target: "60" });

    expect(res.status).toBe(200);
    expect((await request(app).get(campaignKpi()).set(admin)).body).toMatchObject({ metric, target: "60.0000" });
  });

  it("keeps the levels independent", async () => {
    await request(app).put(projectKpis()).set(admin).send([{ metric: "SPEND", target: "1000" }]);

    await request(app).put(campaignKpi()).set(admin).send({ metric: "CTR", target: "2.5" });
    await request(app).put(organizationKpi).set(admin).send({ metric: "ROAS", target: "3" });
    await request(app).delete(campaignKpi()).set(admin);

    expect((await request(app).get(projectKpis()).set(admin)).body)
      .toEqual([expect.objectContaining({ metric: "SPEND", target: "1000.0000" })]);
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
    await request(app).put(campaignKpi()).set(admin).send({ metric: "SPEND", target: "1000" });

    expect((await request(app).put(campaignKpi()).set(admin).send(body)).status).toBe(400);
    expect((await request(app).get(campaignKpi()).set(admin)).body).toMatchObject({ metric: "SPEND", target: "1000.0000" });
  });
});

describe("the KPIs of a project", () => {
  const manual = { metric: "MANUAL", name: "  Продажи ", value: "30", target: "50" };
  const kept = { metric: "SPEND", target: "1000" };
  const read = async (id = projectId) => (await request(app).get(projectKpis(id)).set(admin)).body;

  it("start as an empty list", async () => {
    expect(await read()).toEqual([]);
  });

  it("are saved and read back in order, each enabled unless set otherwise", async () => {
    const saved = await request(app).put(projectKpis()).set(admin).send([
      { metric: "CONVERSIONS", target: "60" },
      { metric: "CPA", target: "20.5", enabled: false },
    ]);

    expect(saved.status).toBe(200);
    expect(saved.body).toEqual([
      { id: expect.any(String), metric: "CONVERSIONS", target: "60.0000", enabled: true, account: null, updatedAt: expect.any(String) },
      { id: expect.any(String), metric: "CPA", target: "20.5000", enabled: false, account: null, updatedAt: expect.any(String) },
    ]);
    expect(await read()).toEqual(saved.body);
  });

  it("are replaced as a whole by the next list, and gone once it is empty", async () => {
    await request(app).put(projectKpis()).set(admin).send([{ metric: "CONVERSIONS", target: "60" }, { metric: "CPA", target: "20" }]);

    await request(app).put(projectKpis()).set(admin).send([{ metric: "CPA", target: "15" }]);
    expect(await read()).toEqual([expect.objectContaining({ metric: "CPA", target: "15.0000" })]);

    expect((await request(app).put(projectKpis()).set(admin).send([])).body).toEqual([]);
    expect(await read()).toEqual([]);
    expect(await prisma.projectKpi.count({ where: { projectId } })).toBe(0);
  });

  it("may aim at the results or the cost of one result type", async () => {
    const saved = await request(app).put(projectKpis()).set(admin).send([
      { metric: "RESULTS", target: "300", resultType: "MESSAGES" },
      { metric: "COST_PER_RESULT", target: "20", resultType: "PROFILE_VISITS" },
      { metric: "RESULTS", target: "50" },
    ]);

    expect(saved.status).toBe(200);
    expect(saved.body.map((kpi: { metric: string; resultType?: string }) => [kpi.metric, kpi.resultType])).toEqual([
      ["RESULTS", "MESSAGES"],
      ["COST_PER_RESULT", "PROFILE_VISITS"],
      ["RESULTS", undefined],
    ]);
    expect(await read()).toEqual(saved.body);
  });

  it("refuse a result type on any other metric -> 400", async () => {
    const res = await request(app).put(projectKpis()).set(admin).send([{ metric: "SPEND", target: "1000", resultType: "MESSAGES" }]);
    expect(res.status).toBe(400);
    expect(await read()).toEqual([]);
  });

  it("refuse the unknown result type -> 400", async () => {
    const res = await request(app).put(projectKpis()).set(admin).send([{ metric: "RESULTS", target: "10", resultType: "UNKNOWN" }]);
    expect(res.status).toBe(400);
  });

  it("refuse a result type that does not exist -> 400", async () => {
    const res = await request(app).put(projectKpis()).set(admin).send([{ metric: "RESULTS", target: "10", resultType: "CALLS" }]);
    expect(res.status).toBe(400);
  });

  it("travel with their result type to the dashboard figures", async () => {
    await request(app).put(projectKpis()).set(admin).send([{ metric: "RESULTS", target: "300", resultType: "MESSAGES" }]);

    const res = await request(app).get("/api/summary/projects?from=2026-09-01&to=2026-09-30").set(admin);
    const project = res.body.find((entry: { projectId: string }) => entry.projectId === projectId);

    expect(project.kpis).toEqual([{ metric: "RESULTS", target: "300.0000", resultType: "MESSAGES", enabled: true, account: null }]);
  });

  it("hold at most five", async () => {
    await request(app).put(projectKpis()).set(admin).send([kept]);
    const six = Array.from({ length: 6 }, () => ({ metric: "CONVERSIONS", target: "1" }));
    const five = six.slice(1);

    expect((await request(app).put(projectKpis()).set(admin).send(six)).status).toBe(400);
    expect(await read()).toEqual([expect.objectContaining({ metric: "SPEND" })]);
    expect((await request(app).put(projectKpis()).set(admin).send(five)).status).toBe(200);
    expect(await read()).toHaveLength(5);
  });

  it("name the account they are measured on, or none", async () => {
    const saved = await request(app).put(projectKpis()).set(admin).send([
      { metric: "CONVERSIONS", target: "60", account: { channel: "META", accountId: " act_1 " } },
      { metric: "CPA", target: "20", account: null },
      { metric: "SPEND", target: "500" },
    ]);

    expect(saved.status).toBe(200);
    expect(saved.body.map((kpi: { account: unknown }) => kpi.account)).toEqual([
      { channel: "META", accountId: "act_1" }, null, null,
    ]);
    expect(await read()).toEqual(saved.body);
  });

  it.each([
    { channel: "FACEBOOK", accountId: "act_1" },
    { channel: "META", accountId: "" },
    { channel: "META" },
    { channel: "META", accountId: "act_1", extra: true },
  ])("refuse an account that is %j", async (account) => {
    await request(app).put(projectKpis()).set(admin).send([kept]);

    expect((await request(app).put(projectKpis()).set(admin).send([{ metric: "CONVERSIONS", target: "1", account }])).status).toBe(400);
    expect(await read()).toEqual([expect.objectContaining({ metric: "SPEND" })]);
  });

  it("hold at most five naming one account, and five naming none", async () => {
    await request(app).put(projectKpis()).set(admin).send([kept]);
    const of = (accountId: string) => ({ metric: "CONVERSIONS", target: "1", account: { channel: "META", accountId } });
    const common = { metric: "CPA", target: "1" };
    const five = <T,>(kpi: T) => Array.from({ length: 5 }, () => kpi);

    expect((await request(app).put(projectKpis()).set(admin).send([...five(of("act_1")), of("act_1")])).status).toBe(400);
    expect(await read()).toEqual([expect.objectContaining({ metric: "SPEND" })]);
    const spread = [...five(common), ...five(of("act_1")), ...five(of("act_2"))];
    expect((await request(app).put(projectKpis()).set(admin).send(spread)).status).toBe(200);
    expect(await read()).toHaveLength(15);
  });

  it.each([
    { metric: "LIKES", target: "10" },
    { metric: "CONVERSIONS", target: "0" },
    { metric: "CONVERSIONS", target: "ten" },
    { metric: "CONVERSIONS", target: 50 },
    { metric: "CONVERSIONS" },
    { metric: "CONVERSIONS", target: "50", extra: true },
    { metric: "CONVERSIONS", target: "50", enabled: "yes" },
  ])("refuse a list holding %j and stay unchanged", async (body) => {
    await request(app).put(projectKpis()).set(admin).send([kept]);

    expect((await request(app).put(projectKpis()).set(admin).send([{ metric: "CPA", target: "10" }, body])).status).toBe(400);
    expect(await read()).toEqual([expect.objectContaining({ metric: "SPEND", target: "1000.0000" })]);
  });

  it("refuse a body that is not a list", async () => {
    expect((await request(app).put(projectKpis()).set(admin).send(kept)).status).toBe(400);
  });

  it("may hold a KPI set by hand beside the others, with its name, value and target", async () => {
    const saved = await request(app).put(projectKpis()).set(admin).send([{ metric: "CONVERSIONS", target: "60" }, manual]);

    expect(saved.status).toBe(200);
    expect(saved.body[1]).toEqual({
      id: expect.any(String), metric: "MANUAL", name: "Продажи", value: "30.0000", target: "50.0000",
      enabled: true, account: null, updatedAt: expect.any(String),
    });
    expect((await request(app).put(projectKpis()).set(admin).send([{ ...manual, value: "0" }])).body[0]).toMatchObject({ value: "0.0000" });
  });

  it.each([
    { ...manual, name: "" },
    { ...manual, name: "   " },
    { ...manual, name: "Я".repeat(101) },
    { ...manual, value: "-1" },
    { ...manual, value: "ten" },
    { ...manual, value: "1.23456" },
    { ...manual, target: "0" },
    { metric: "MANUAL", value: "30", target: "50" },
    { metric: "MANUAL", name: "Продажи", target: "50" },
    { ...manual, extra: true },
    { metric: "CONVERSIONS", name: "Продажи", value: "30", target: "50" },
  ])("refuse a KPI set by hand that is %j", async (body) => {
    await request(app).put(projectKpis()).set(admin).send([kept]);

    expect((await request(app).put(projectKpis()).set(admin).send([body])).status).toBe(400);
    expect(await read()).toEqual([expect.objectContaining({ metric: "SPEND", target: "1000.0000" })]);
  });

  it.each([
    ["campaign", () => campaignKpi()],
    ["organization", () => organizationKpi],
  ])("cannot be set by hand on the %s", async (_level, path) => {
    const res = await request(app).put(path()).set(admin).send(manual);

    expect(res.status).toBe(400);
    expect((await request(app).get(path()).set(admin)).body).toBeNull();
  });

  it("are refused to a client like any KPI", async () => {
    const customer = await signInAs("Client", { role: "CLIENT" });
    await grantAccess(customer.membership!.id, clientId);

    expect((await request(app).put(projectKpis()).set(customer.auth).send([manual])).status).toBe(403);
    expect(await read()).toEqual([]);
  });
});

describe("a campaign KPI", () => {
  it("may aim at the cost of one result type, and travels with it on the campaign", async () => {
    const saved = await request(app).put(campaignKpi()).set(admin).send({ metric: "COST_PER_RESULT", target: "20", resultType: "MESSAGES" });

    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({ metric: "COST_PER_RESULT", target: "20.0000", resultType: "MESSAGES", updatedAt: expect.any(String) });
    expect((await request(app).get(campaignKpi()).set(admin)).body).toMatchObject({ resultType: "MESSAGES" });
    const campaign = await request(app).get(`/api/campaigns/${campaignId}?from=2026-09-01&to=2026-09-30`).set(admin);
    expect(campaign.body.kpi).toEqual({ metric: "COST_PER_RESULT", target: "20.0000", resultType: "MESSAGES" });
  });

  it("loses the result type when replaced by a KPI without one", async () => {
    await request(app).put(campaignKpi()).set(admin).send({ metric: "RESULTS", target: "10", resultType: "MESSAGES" });
    await request(app).put(campaignKpi()).set(admin).send({ metric: "RESULTS", target: "12" });

    expect((await request(app).get(campaignKpi()).set(admin)).body).toEqual({ metric: "RESULTS", target: "12.0000", updatedAt: expect.any(String) });
  });

  it.each([
    ["on any other metric", { metric: "SPEND", target: "1000", resultType: "MESSAGES" }],
    ["of the unknown type", { metric: "RESULTS", target: "10", resultType: "UNKNOWN" }],
    ["that does not exist", { metric: "RESULTS", target: "10", resultType: "CALLS" }],
  ])("refuses a result type %s -> 400", async (_case, body) => {
    const res = await request(app).put(campaignKpi()).set(admin).send(body);

    expect(res.status).toBe(400);
    expect((await request(app).get(campaignKpi()).set(admin)).body).toBeNull();
  });
});

describe("the organization KPI", () => {
  it("names no result type -> 400", async () => {
    const res = await request(app).put(organizationKpi).set(admin).send({ metric: "RESULTS", target: "10", resultType: "MESSAGES" });

    expect(res.status).toBe(400);
    expect((await request(app).get(organizationKpi).set(admin)).body).toBeNull();
  });
});

describe("who reaches and changes a KPI", () => {
  it("answers 404 for projects and campaigns out of reach", async () => {
    const stranger = await signInAs("Stranger", { role: "MANAGER" });
    const outsider = await signInAsOutsider();
    const theirs = await prisma.project.create({ data: { clientId: outsider.client.id, name: "Theirs", position: 0 } });

    expect((await request(app).get(projectKpis()).set(stranger.auth)).status).toBe(404);
    expect((await request(app).put(projectKpis()).set(stranger.auth).send([{ metric: "CONVERSIONS", target: "5" }])).status).toBe(404);
    expect((await request(app).get(campaignKpi()).set(stranger.auth)).status).toBe(404);
    expect((await request(app).put(campaignKpi()).set(stranger.auth).send({ metric: "CONVERSIONS", target: "5" })).status).toBe(404);
    expect((await request(app).get(projectKpis(theirs.id)).set(admin)).status).toBe(404);
    expect((await request(app).get(campaignKpi("00000000-0000-4000-8000-000000000000")).set(admin)).status).toBe(404);
  });

  it("lets readers of a project read its KPIs and only staff change them", async () => {
    await request(app).put(projectKpis()).set(admin).send([{ metric: "CONVERSIONS", target: "50" }]);
    const client = await signInAs("Client", { role: "CLIENT" });
    await grantAccess(client.membership!.id, clientId);
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId);

    for (const reader of [client, guest]) {
      expect((await request(app).get(projectKpis()).set(reader.auth)).body).toEqual([expect.objectContaining({ metric: "CONVERSIONS" })]);
      expect((await request(app).put(projectKpis()).set(reader.auth).send([{ metric: "CPA", target: "10" }])).status).toBe(403);
      expect((await request(app).put(campaignKpi()).set(reader.auth).send({ metric: "CPA", target: "10" })).status).toBe(403);
    }
    expect((await request(app).put(projectKpis()).set(manager.auth).send([{ metric: "CPA", target: "10" }])).status).toBe(200);
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
    expect((await request(app).get(projectKpis())).status).toBe(401);
    expect((await request(app).put(projectKpis()).send([])).status).toBe(401);
    expect((await request(app).put(organizationKpi).send({ metric: "SPEND", target: "1" })).status).toBe(401);
  });
});

describe("auditing KPI changes", () => {
  it("records the level, the metric and the target before and after", async () => {
    await request(app).put(campaignKpi()).set(admin).send({ metric: "CPA", target: "20" });
    await request(app).put(campaignKpi()).set(admin).send({ metric: "CPA", target: "15" });
    await request(app).delete(campaignKpi()).set(admin);
    await request(app).put(organizationKpi).set(admin).send({ metric: "SPEND", target: "5000" });

    const events = await prisma.auditEvent.findMany({ where: BUSINESS_EVENTS, orderBy: { createdAt: "asc" } });
    expect(events.map((event) => [event.entityType, event.action, event.changes])).toEqual([
      ["campaign", "UPDATE", { before: null, after: { metric: "CPA", target: "20.0000" } }],
      ["campaign", "UPDATE", { before: { metric: "CPA", target: "20.0000" }, after: { metric: "CPA", target: "15.0000" } }],
      ["campaign", "UPDATE", { before: { metric: "CPA", target: "15.0000" }, after: null }],
      ["organization", "UPDATE", { before: null, after: { metric: "SPEND", target: "5000.0000" } }],
    ]);
    expect(events[0]).toMatchObject({ entityId: campaignId, campaignId, projectId, clientId });
  });

  it("records one event for a replaced list of project KPIs, with every KPI before and after", async () => {
    await request(app).put(projectKpis()).set(admin).send([{ metric: "MANUAL", name: "Продажи", value: "30", target: "50" }]);
    await request(app).put(projectKpis()).set(admin).send([
      { metric: "CONVERSIONS", target: "60" },
      { metric: "CPA", target: "20", enabled: false },
    ]);
    await request(app).put(projectKpis()).set(admin).send([]);

    const events = await prisma.auditEvent.findMany({ where: BUSINESS_EVENTS, orderBy: { createdAt: "asc" } });
    const first = { metric: "MANUAL", name: "Продажи", value: "30.0000", target: "50.0000", enabled: true };
    const second = [
      { metric: "CONVERSIONS", target: "60.0000", enabled: true },
      { metric: "CPA", target: "20.0000", enabled: false },
    ];
    expect(events.map((event) => event.changes)).toEqual([
      { before: [], after: [first] },
      { before: [first], after: second },
      { before: second, after: [] },
    ]);
    expect(events[0]).toMatchObject({ entityType: "project", entityId: projectId, projectId, clientId });
  });

  it("records the account a KPI names", async () => {
    await request(app).put(projectKpis()).set(admin).send([
      { metric: "CONVERSIONS", target: "60", account: { channel: "META", accountId: "act_1" } },
    ]);

    const [event] = await prisma.auditEvent.findMany({ where: BUSINESS_EVENTS });
    expect(event?.changes).toEqual({
      before: [], after: [{ metric: "CONVERSIONS", target: "60.0000", enabled: true, account: "META:act_1" }],
    });
  });

  it("records nothing for a refused change or an empty list over an empty list", async () => {
    await request(app).put(projectKpis()).set(admin).send([{ metric: "LIKES", target: "1" }]);
    await request(app).put(projectKpis()).set(admin).send([]);

    expect(await prisma.auditEvent.count({ where: BUSINESS_EVENTS })).toBe(0);
  });
});
