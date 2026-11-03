import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { addMonths, monthOf } from "../../src/modules/reports/domain/month.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";
import { expectAudit } from "../helpers/audit.js";

const app = createApp();
const thisMonth = monthOf(new Date());
const month = addMonths(thisMonth, -2);
const before = addMonths(thisMonth, -3);
const later = addMonths(thisMonth, -1);

let admin: { Authorization: string };
let clientId: string;
let projectId: string;
let campaignId: string;
let adSetId: string;

const reports = (id = projectId) => `/api/projects/${id}/reports`;
const day = (of: string, date = 10) => new Date(`${of}-${String(date).padStart(2, "0")}T00:00:00Z`);

async function record(of: string, spend: string, conversions: number, date = 10) {
  await prisma.campaignDailyMetric.upsert({
    where: { campaignId_date: { campaignId, date: day(of, date) } },
    create: { campaignId, date: day(of, date), spend, conversions },
    update: { spend, conversions },
  });
}

async function ad(name: string, of: string, spend: string, conversions: number) {
  const created = await prisma.ad.create({ data: { adSetId, name, position: await prisma.ad.count() } });
  await prisma.adDailyMetric.create({ data: { adId: created.id, date: day(of), spend, conversions } });
  return created.id;
}

async function generate(of = month, auth = admin) {
  return request(app).post(reports()).set(auth).send({ month: of });
}

async function member(role: "MANAGER" | "GUEST" | "CLIENT" | "CLIENT_ADMIN") {
  const signed = await signInAs(role, { role });
  await grantAccess(signed.membership!.id, clientId);
  return signed.auth;
}

beforeEach(async () => {
  await resetDb();
  const signed = await signInAs();
  admin = signed.auth;
  ({ clientId, projectId } = await seedProject(signed.user.id));
  await prisma.project.update({ where: { id: projectId }, data: { budgetCurrency: "USD" } });
  campaignId = (await seedCampaign(projectId, "Windows", "META")).id;
  adSetId = (await prisma.adSet.create({ data: { campaignId, name: "Set", position: 0 } })).id;
});

afterAll(() => prisma.$disconnect());

describe("generating a report", () => {
  it("computes spend, leads, cost per lead, the change and the trend of a finished month", async () => {
    await record(before, "3080.8500", 69);
    await record(month, "1500.0000", 50, 3);
    await record(month, "1580.7700", 45, 20);

    const response = await generate();

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      month, status: "DRAFT", currency: "USD",
      spend: "3080.7700", leads: 95, costPerLead: "32.4292",
      previous: { month: before, leads: 69 },
      change: { leads: "0.3768" },
      computedLeads: 95, leadsOverride: null,
    });
    expect(response.body.trend.map((point: { month: string }) => point.month)).toEqual([before, month]);
    await expectAudit({ action: "CREATE", entityType: "report", entityId: response.body.id, clientId, projectId });
  });

  it("suggests the three ads with the most leads and offers every ad that spent", async () => {
    const best = await ad("Best", month, "100", 9);
    const second = await ad("Second", month, "50", 5);
    const third = await ad("Third", month, "80", 5);
    await ad("Fourth", month, "10", 1);
    await ad("Silent", month, "20", 0);
    await ad("Idle", before, "20", 3);

    const response = await generate();

    expect(response.body.ads.map((entry: { adId: string }) => entry.adId)).toEqual([best, second, third]);
    expect(response.body.ads[0]).toMatchObject({ name: "Best", leads: 9, spend: "100.0000", costPerLead: "11.1111" });
    expect(response.body.runningAds).toHaveLength(5);
  });

  it("shows no cost per lead for a month without leads", async () => {
    await record(month, "200.0000", 0);
    expect((await generate()).body).toMatchObject({ spend: "200.0000", leads: 0, costPerLead: null });
  });

  it("refuses the current month and a malformed one", async () => {
    expect((await generate(thisMonth)).status).toBe(400);
    expect((await generate("2026-13")).status).toBe(400);
    expect(await prisma.monthlyReport.count()).toBe(0);
  });

  it("answers 409 for a second report of the same month", async () => {
    expect((await generate()).status).toBe(201);
    expect((await generate()).status).toBe(409);
  });
});

describe("stored figures", () => {
  it("stay put when the synced data changes, until refreshed", async () => {
    await record(month, "100.0000", 10);
    const { id } = (await generate()).body;
    await request(app).patch(`${reports()}/${id}`).set(admin).send({ messengerContacts: 12, leadsOverride: 9 });

    await record(month, "300.0000", 30);
    expect((await request(app).get(`/api/reports/${id}`).set(admin)).body).toMatchObject({ spend: "100.0000", computedLeads: 10 });

    const refreshed = await request(app).post(`${reports()}/${id}/refresh`).set(admin);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body).toMatchObject({ spend: "300.0000", computedLeads: 30, leads: 9, leadsOverride: 9, messengerContacts: 12 });
  });

  it("keep the chosen ads on refresh", async () => {
    const chosen = await ad("Chosen", month, "10", 0);
    await ad("Other", month, "10", 4);
    const { id } = (await generate()).body;
    await request(app).patch(`${reports()}/${id}`).set(admin).send({ adIds: [chosen] });

    const refreshed = await request(app).post(`${reports()}/${id}/refresh`).set(admin);

    expect(refreshed.body.ads.map((entry: { adId: string }) => entry.adId)).toEqual([chosen]);
  });
});

describe("hand-entered parts", () => {
  it("let a corrected lead count drive cost per lead and the change, and clear back", async () => {
    await record(before, "690.0000", 69);
    await record(month, "3080.7700", 95);
    const { id } = (await generate()).body;

    const corrected = await request(app).patch(`${reports()}/${id}`).set(admin).send({ leadsOverride: 90 });
    expect(corrected.status).toBe(200);
    expect(corrected.body).toMatchObject({ leads: 90, computedLeads: 95, costPerLead: "34.2308", change: { leads: "0.3043" } });

    const cleared = await request(app).patch(`${reports()}/${id}`).set(admin).send({ leadsOverride: null });
    expect(cleared.body).toMatchObject({ leads: 95, leadsOverride: null, costPerLead: "32.4292" });
  });

  it("carry an earlier month's correction into a later report", async () => {
    await record(month, "700.0000", 69);
    await record(later, "950.0000", 95);
    const earlier = (await generate(month)).body;
    await request(app).patch(`${reports()}/${earlier.id}`).set(admin).send({ leadsOverride: 70 });

    const next = (await generate(later)).body;

    expect(next.previous).toMatchObject({ month, leads: 70 });
    expect(next.change.leads).toBe("0.3571");
  });

  it("keep conclusions, plan and messenger contacts", async () => {
    const { id } = (await generate()).body;
    const conclusions = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Grew", marks: [{ type: "bold" }] }] }] };
    const plan = { type: "doc", content: [{ type: "orderedList" }] };

    const response = await request(app).patch(`${reports()}/${id}`).set(admin).send({ conclusions, plan, messengerContacts: 12 });

    expect(response.body).toMatchObject({ conclusions, plan, messengerContacts: 12 });
    await expectAudit({ action: "UPDATE", entityType: "report", entityId: id, projectId });
  });

  it("keep the chosen ads in the order set and refuse an ad that did not spend in the month", async () => {
    const first = await ad("First", month, "10", 1);
    const second = await ad("Second", month, "10", 2);
    const idle = await ad("Idle", before, "10", 2);
    const { id } = (await generate()).body;

    const ordered = await request(app).patch(`${reports()}/${id}`).set(admin).send({ adIds: [first, second] });
    expect(ordered.body.ads.map((entry: { adId: string }) => entry.adId)).toEqual([first, second]);

    for (const adIds of [[idle], [first, first], ["a", "b", "c", "d", "e", "f", "g"]]) {
      expect((await request(app).patch(`${reports()}/${id}`).set(admin).send({ adIds })).status).toBe(400);
    }
    expect((await request(app).get(`/api/reports/${id}`).set(admin)).body.ads.map((entry: { adId: string }) => entry.adId)).toEqual([first, second]);
  });

  it.each([{ leadsOverride: -1 }, { leadsOverride: 1.5 }, { messengerContacts: "12" }, { conclusions: "text" }, { status: "PUBLISHED" }])(
    "refuses %j", async (body) => {
      const { id } = (await generate()).body;
      expect((await request(app).patch(`${reports()}/${id}`).set(admin).send(body)).status).toBe(400);
    },
  );
});

async function messages(of: string, results: number) {
  const set = await prisma.adSet.create({ data: { campaignId, name: "Direct", optimizationGoal: "CONVERSATIONS", position: 1 } });
  await prisma.adSetDailyMetric.create({ data: { adSetId: set.id, date: day(of), spend: "50", results } });
}

async function calls(of: string, results: number) {
  const google = await seedCampaign(projectId, "Search", "GOOGLE");
  await prisma.campaign.update({ where: { id: google.id }, data: { conversionCategories: ["PHONE_CALL_LEAD"] } });
  await prisma.campaignDailyMetric.create({ data: { campaignId: google.id, date: day(of), spend: "30", conversions: results } });
  await prisma.campaignDailyResult.create({ data: { campaignId: google.id, date: day(of), category: "PHONE_CALL_LEAD", results } });
}

describe("the fourth figure", () => {
  it("starts on messages and stores the month's results by type", async () => {
    await messages(month, 105);
    await calls(month, 12);

    const response = await generate();

    expect(response.body).toMatchObject({ contactsSource: "MESSAGES", contacts: 105 });
    expect(response.body.resultTotals).toEqual(expect.arrayContaining([
      { type: "MESSAGES", results: 105 }, { type: "CALLS", results: 12 },
    ]));
  });

  it("keeps the hand-entered count for a month without messages", async () => {
    await calls(month, 12);

    const response = await generate();

    expect(response.body).toMatchObject({ contactsSource: null, contacts: null });
  });

  it("switches to another type and back to the count entered by hand, refusing a type without results", async () => {
    await messages(month, 105);
    await calls(month, 12);
    const { id } = (await generate()).body;

    const chosen = await request(app).patch(`${reports()}/${id}`).set(admin).send({ contactsSource: "CALLS" });
    expect(chosen.body).toMatchObject({ contactsSource: "CALLS", contacts: 12 });

    for (const contactsSource of ["PROFILE_VISITS", "NOT_A_TYPE"]) {
      expect((await request(app).patch(`${reports()}/${id}`).set(admin).send({ contactsSource })).status).toBe(400);
    }

    const manual = await request(app).patch(`${reports()}/${id}`).set(admin).send({ contactsSource: null, messengerContacts: 40 });
    expect(manual.body).toMatchObject({ contactsSource: null, contacts: 40, messengerContacts: 40 });
  });

  it("offers only the hand-entered count on a report stored before results by type, until refreshed", async () => {
    await calls(month, 12);
    const { id, spend, leads, trend, runningAds } = (await generate()).body;
    await prisma.monthlyReport.update({
      where: { id },
      data: { figures: { spend, leads, history: trend.slice(0, -1).map(({ month: of, spend: s, leads: l }: { month: string; spend: string; leads: number }) => ({ month: of, spend: s, leads: l })), ads: runningAds } },
    });

    expect((await request(app).get(`/api/reports/${id}`).set(admin)).body.resultTotals).toBeNull();
    expect((await request(app).patch(`${reports()}/${id}`).set(admin).send({ contactsSource: "CALLS" })).status).toBe(400);

    const refreshed = await request(app).post(`${reports()}/${id}/refresh`).set(admin);
    expect(refreshed.body.resultTotals).toEqual([{ type: "CALLS", results: 12 }]);
    expect(refreshed.body.contactsSource).toBeNull();
    expect((await request(app).patch(`${reports()}/${id}`).set(admin).send({ contactsSource: "CALLS" })).body.contacts).toBe(12);
  });

  it("shows readers the figure without the choice", async () => {
    await messages(month, 105);
    const { id } = (await generate()).body;
    await request(app).post(`${reports()}/${id}/publish`).set(admin);

    const read = await request(app).get(`/api/reports/${id}`).set(await member("CLIENT"));

    expect(read.body).toMatchObject({ contactsSource: "MESSAGES", contacts: 105 });
    expect(read.body).not.toHaveProperty("resultTotals");
  });
});

describe("months entered for the trend", () => {
  const history = (id: string) => `${reports()}/${id}/history`;

  it("fill months before the first synced month and show them on the report at once", async () => {
    await record(month, "1000.0000", 40);
    const { id } = (await generate()).body;

    const response = await request(app).put(history(id)).set(admin).send({ months: [
      { month: addMonths(month, -3), leads: 40, spend: "900" },
      { month: addMonths(month, -2), leads: 52, spend: null },
    ] });

    expect(response.status).toBe(200);
    expect(response.body.trend).toEqual([
      { month: addMonths(month, -3), spend: "900.0000", leads: 40, costPerLead: "22.5000" },
      { month: addMonths(month, -2), spend: null, leads: 52, costPerLead: null },
      { month: addMonths(month, -1), spend: null, leads: 0, costPerLead: null },
      { month, spend: "1000.0000", leads: 40, costPerLead: "25.0000" },
    ]);
    expect(response.body.history).toEqual([
      { month: addMonths(month, -3), leads: 40, spend: "900.0000" },
      { month: addMonths(month, -2), leads: 52, spend: null },
    ]);
    await expectAudit({ action: "UPDATE", entityType: "report", entityId: id, projectId });
  });

  it("win over the synced count and a correction, and clearing one restores them", async () => {
    await record(before, "690.0000", 58);
    await record(month, "950.0000", 95);
    const earlier = (await generate(before)).body;
    await request(app).patch(`${reports()}/${earlier.id}`).set(admin).send({ leadsOverride: 60 });
    const { id } = (await generate(month)).body;

    const entered = await request(app).put(history(id)).set(admin).send({ months: [{ month: before, leads: 64, spend: null }] });
    expect(entered.body.previous).toMatchObject({ month: before, leads: 64, spend: "690.0000" });

    const cleared = await request(app).put(history(id)).set(admin).send({ months: [{ month: before, leads: null, spend: null }] });
    expect(cleared.body.previous).toMatchObject({ month: before, leads: 60 });
    expect(cleared.body.history).toEqual([]);
  });

  it("reach another report when it is refreshed", async () => {
    await record(month, "100.0000", 5);
    await record(later, "100.0000", 5);
    const first = (await generate(month)).body;
    const second = (await generate(later)).body;

    await request(app).put(history(second.id)).set(admin).send({ months: [{ month: addMonths(month, -1), leads: 30, spend: "300" }] });

    expect((await request(app).get(`/api/reports/${first.id}`).set(admin)).body.trend[0].month).toBe(month);
    const refreshed = await request(app).post(`${reports()}/${first.id}/refresh`).set(admin);
    expect(refreshed.body.trend[0]).toMatchObject({ month: addMonths(month, -1), leads: 30 });
    expect(refreshed.body.history).toEqual([{ month: addMonths(month, -1), leads: 30, spend: "300.0000" }]);
  });

  it.each([
    { months: [{ month: "SELF", leads: 1, spend: null }] },
    { months: [{ month: "SIX_BACK", leads: 1, spend: null }] },
    { months: [{ month: "ONE_BACK", leads: -1, spend: null }] },
    { months: [{ month: "ONE_BACK", leads: 1.5, spend: null }] },
    { months: [{ month: "ONE_BACK", leads: 1, spend: "-5" }] },
    { months: [{ month: "ONE_BACK", leads: 1, spend: null }, { month: "ONE_BACK", leads: 2, spend: null }] },
  ])("refuse %j", async (body) => {
    const { id } = (await generate()).body;
    const named: Record<string, string> = { SELF: month, SIX_BACK: addMonths(month, -6), ONE_BACK: addMonths(month, -1) };
    const months = body.months.map((entry) => ({ ...entry, month: named[entry.month] }));

    expect((await request(app).put(history(id)).set(admin).send({ months })).status).toBe(400);
    expect(await prisma.projectMonthFigure.count()).toBe(0);
  });

  it("are entered by staff alone, and readers see only the trend", async () => {
    const { id } = (await generate()).body;
    await request(app).put(history(id)).set(admin).send({ months: [{ month: addMonths(month, -1), leads: 7, spend: null }] });
    await request(app).post(`${reports()}/${id}/publish`).set(admin);
    const reader = await member("CLIENT");

    expect((await request(app).put(history(id)).set(reader).send({ months: [] })).status).toBe(403);
    const read = await request(app).get(`/api/reports/${id}`).set(reader);
    expect(read.body.trend[0]).toMatchObject({ month: addMonths(month, -1), leads: 7 });
    expect(read.body).not.toHaveProperty("history");
  });
});

describe("publishing and reach", () => {
  it("shows drafts to staff alone and published reports to every reader", async () => {
    const draft = (await generate(month)).body;
    const published = (await generate(before)).body;
    await request(app).post(`${reports()}/${published.id}/publish`).set(admin);

    for (const role of ["CLIENT", "CLIENT_ADMIN", "GUEST"] as const) {
      const reader = await member(role);
      const listed = await request(app).get(reports()).set(reader);
      expect(listed.body.reports.map((entry: { id: string }) => entry.id)).toEqual([published.id]);
      expect(listed.body.available).toEqual([]);
      expect((await request(app).get(`/api/reports/${draft.id}`).set(reader)).status).toBe(404);
      const read = await request(app).get(`/api/reports/${published.id}`).set(reader);
      expect(read.status).toBe(200);
      expect(read.body).not.toHaveProperty("computedLeads");
      expect(read.body).not.toHaveProperty("runningAds");
    }

    const manager = await member("MANAGER");
    expect((await request(app).get(reports()).set(manager)).body.reports).toHaveLength(2);
  });

  it("returns a report to draft", async () => {
    const { id } = (await generate()).body;
    const published = await request(app).post(`${reports()}/${id}/publish`).set(admin);
    expect(published.body).toMatchObject({ status: "PUBLISHED", publishedAt: expect.any(String) });
    const unpublished = await request(app).post(`${reports()}/${id}/unpublish`).set(admin);
    expect(unpublished.body).toMatchObject({ status: "DRAFT", publishedAt: null });
  });

  it("lets only staff write", async () => {
    const { id } = (await generate()).body;
    await request(app).post(`${reports()}/${id}/publish`).set(admin);

    for (const role of ["CLIENT", "CLIENT_ADMIN", "GUEST"] as const) {
      const reader = await member(role);
      expect((await generate(before, reader)).status).toBe(403);
      expect((await request(app).patch(`${reports()}/${id}`).set(reader).send({ messengerContacts: 1 })).status).toBe(403);
      for (const action of ["refresh", "publish", "unpublish"]) {
        expect((await request(app).post(`${reports()}/${id}/${action}`).set(reader)).status).toBe(403);
      }
      expect((await request(app).delete(`${reports()}/${id}`).set(reader)).status).toBe(403);
    }
    expect((await request(app).get(`/api/reports/${id}`).set(admin)).body).toMatchObject({ status: "PUBLISHED", messengerContacts: null });

    const manager = await member("MANAGER");
    expect((await request(app).patch(`${reports()}/${id}`).set(manager).send({ messengerContacts: 3 })).status).toBe(200);
    expect((await generate(before, manager)).status).toBe(201);
  });

  it("answers 404 outside the project's reach", async () => {
    const { id } = (await generate()).body;
    const stranger = await signInAs("Stranger", { role: "MANAGER" });
    const outsider = await signInAsOutsider();

    for (const auth of [stranger.auth, outsider.auth]) {
      expect((await request(app).get(reports()).set(auth)).status).toBe(404);
      expect((await request(app).get(`/api/reports/${id}`).set(auth)).status).toBe(404);
      expect((await generate(before, auth)).status).toBe(404);
    }
    const other = await seedProject(stranger.user.id, "Other");
    expect((await request(app).post(`${reports(other.projectId)}/${id}/refresh`).set(admin)).status).toBe(404);
  });

  it("deletes a report so its month can be generated again", async () => {
    const { id } = (await generate()).body;
    expect((await request(app).delete(`${reports()}/${id}`).set(admin)).status).toBe(204);
    await expectAudit({ action: "DELETE", entityType: "report", entityId: id, projectId });
    expect((await generate()).status).toBe(201);
  });

  it("offers staff the twelve most recent ended months that have no report", async () => {
    const offered = (await request(app).get(reports()).set(admin)).body;
    expect(offered).toEqual({ reports: [], available: Array.from({ length: 12 }, (_, index) => addMonths(later, -index)) });
    await generate(month);
    const after = (await request(app).get(reports()).set(admin)).body.available;
    expect(after).toHaveLength(11);
    expect(after).not.toContain(month);
    expect(after).not.toContain(thisMonth);
  });
});

describe("reports across projects", () => {
  it("lists every reachable project's reports, newest month first, and filters by project", async () => {
    const own = (await generate(month)).body;
    const other = await seedProject("ignored", "Other");
    const otherReport = (await request(app).post(reports(other.projectId)).set(admin).send({ month: later })).body;
    const outsider = await signInAsOutsider();
    const hidden = await prisma.project.create({ data: { clientId: outsider.client.id, name: "Hidden", position: 0 } });
    await request(app).post(reports(hidden.id)).set(outsider.auth).send({ month });

    const all = await request(app).get("/api/reports").set(admin);
    expect(all.status).toBe(200);
    expect(all.body.map((entry: { id: string; projectId: string }) => [entry.id, entry.projectId])).toEqual([
      [otherReport.id, other.projectId],
      [own.id, projectId],
    ]);

    const filtered = await request(app).get(`/api/reports?projectId=${projectId}`).set(admin);
    expect(filtered.body.map((entry: { id: string }) => entry.id)).toEqual([own.id]);
  });

  it("shows customers published reports of their own projects only", async () => {
    const draft = (await generate(month)).body;
    const published = (await generate(before)).body;
    await request(app).post(`${reports()}/${published.id}/publish`).set(admin);
    const other = await seedProject("ignored", "Other");
    const elsewhere = (await request(app).post(reports(other.projectId)).set(admin).send({ month })).body;
    await request(app).post(`${reports(other.projectId)}/${elsewhere.id}/publish`).set(admin);

    const client = await member("CLIENT");
    expect((await request(app).get("/api/reports").set(client)).body.map((entry: { id: string }) => entry.id)).toEqual([published.id]);
    expect((await request(app).get(`/api/reports/${draft.id}`).set(client)).status).toBe(404);
    expect((await request(app).get(`/api/reports/${elsewhere.id}`).set(client)).status).toBe(404);
    const read = await request(app).get(`/api/reports/${published.id}`).set(client);
    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({ id: published.id, projectId, status: "PUBLISHED" });
  });

  it("answers 404 for an unknown report", async () => {
    expect((await request(app).get("/api/reports/00000000-0000-4000-8000-000000000000").set(admin)).status).toBe(404);
  });
});

describe("the cover picture", () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
  const cover = (id: string) => `${reports()}/${id}/cover`;

  it("is uploaded by staff, served to readers and removed", async () => {
    const { id } = (await generate()).body;
    expect((await request(app).get(`/api/reports/${id}`).set(admin)).body.hasCover).toBe(false);

    const uploaded = await request(app).put(cover(id)).set(admin).attach("image", png, { filename: "cover.png", contentType: "image/png" });
    expect(uploaded.status).toBe(200);
    expect(uploaded.body.hasCover).toBe(true);
    await expectAudit({ action: "UPDATE", entityType: "report", entityId: id, projectId });

    await request(app).post(`${reports()}/${id}/publish`).set(admin);
    const client = await member("CLIENT");
    const served = await request(app).get(cover(id)).set(client).buffer(true).parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => done(null, Buffer.concat(chunks)));
    });
    expect(served.status).toBe(200);
    expect(served.headers["content-type"]).toBe("image/png");
    expect(Buffer.compare(served.body as Buffer, png)).toBe(0);

    const removed = await request(app).delete(cover(id)).set(admin);
    expect(removed.body.hasCover).toBe(false);
    expect((await request(app).get(cover(id)).set(admin)).status).toBe(404);
  });

  it("refuses what is not a picture and pictures over 10 MB", async () => {
    const { id } = (await generate()).body;
    const pdf = Buffer.from("%PDF-1.7 not a picture");
    expect((await request(app).put(cover(id)).set(admin).attach("image", pdf, { filename: "cover.png", contentType: "image/png" })).status).toBe(400);
    const huge = Buffer.concat([png, Buffer.alloc(10 * 1024 * 1024)]);
    expect((await request(app).put(cover(id)).set(admin).attach("image", huge, { filename: "big.png", contentType: "image/png" })).status).toBe(400);
    expect((await request(app).put(cover(id)).set(admin)).status).toBe(400);
    expect((await request(app).get(`/api/reports/${id}`).set(admin)).body.hasCover).toBe(false);
  });

  it("is changed by staff alone and hidden with the draft", async () => {
    const { id } = (await generate()).body;
    await request(app).put(cover(id)).set(admin).attach("image", png, { filename: "cover.png", contentType: "image/png" });
    const client = await member("CLIENT");
    expect((await request(app).get(cover(id)).set(client)).status).toBe(404);
    await request(app).post(`${reports()}/${id}/publish`).set(admin);
    expect((await request(app).put(cover(id)).set(client).attach("image", png, { filename: "c.png", contentType: "image/png" })).status).toBe(403);
    expect((await request(app).delete(cover(id)).set(client)).status).toBe(403);
  });
});
