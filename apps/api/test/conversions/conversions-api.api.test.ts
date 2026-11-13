import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { localDate } from "../../src/shared/application/index.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, grantAccess, signInAs } from "../helpers/auth.js";

const DAY = 24 * 60 * 60 * 1000;
const token = "synthetic-capi-token-abcdef";
const MISSING = "00000000-0000-4000-8000-000000000000";

let app: ReturnType<typeof createApp>;
let auth: { Authorization: string };
let orgId: string;
let clientId: string;
let projectId: string;
let fetcher: ReturnType<typeof vi.fn>;

const path = (id: string = projectId) => `/api/projects/${id}/conversions-api`;
const datasetReply = (name = "Пиксель клиента", id = "1234567890") =>
  fetcher.mockResolvedValue(new Response(JSON.stringify({ id, name })));

beforeEach(async () => {
  await resetDb();
  const admin = await signInAs();
  auth = admin.auth;
  orgId = (await currentOrg()).id;
  ({ clientId, projectId } = await seedProject(admin.user.id));
  await prisma.project.update({ where: { id: projectId }, data: { budgetCurrency: "BYN" } });
  await prisma.projectIntegration.create({
    data: {
      projectId, accountId: "123", currency: "BYN", timezone: "Europe/Minsk", encryptedToken: "encrypted", revision: "v1",
      status: "SUCCESS", nextDailyAt: new Date(Date.now() + DAY),
    },
  });
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  fetcher = vi.fn();
  datasetReply();
  vi.stubGlobal("fetch", fetcher);
  app = createApp();
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
afterAll(() => prisma.$disconnect());

const connect = (body: object = { datasetId: "1234567890", token }, as = auth) => request(app).put(path()).set(as).send(body);

const formLead = async (name: string, externalId: string) => {
  const lead = await prisma.lead.create({ data: { orgId, projectId, name, origin: "META", stage: "NEW", position: 0 } });
  await prisma.metaLead.create({ data: { orgId, externalId, leadId: lead.id } });
  return lead;
};
const enters = (leadId: string, toStage: string, changedAt: Date) =>
  prisma.leadStageChange.create({ data: { orgId, projectId, leadId, toStage, changedAt, processedAt: changedAt } });

describe("connecting a Meta dataset", () => {
  it("checks the dataset with Meta, stores the token encrypted and never returns it", async () => {
    const response = await connect({ datasetId: "1234567890", token, testEventCode: "TEST123" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      dataset: {
        datasetId: "1234567890", datasetName: "Пиксель клиента", testEventCode: "TEST123", currency: "BYN",
        state: "ACTIVE", lastError: null, lastSentAt: null,
      },
      counts: { today: 0, week: 0, month: 0 },
      recent: [],
    });
    expect(String(fetcher.mock.calls[0]![0])).toBe("https://graph.facebook.com/v22.0/1234567890?fields=id%2Cname");
    const stored = await prisma.metaDataset.findUniqueOrThrow({ where: { projectId } });
    expect(stored.encryptedToken).not.toContain(token);
    expect(JSON.stringify((await request(app).get(path()).set(auth).expect(200)).body)).not.toContain(stored.encryptedToken);
    const audit = await prisma.auditEvent.findMany({ where: { projectId } });
    expect(audit.map((entry) => entry.summary)).toEqual(["Connect Meta dataset"]);
    expect(JSON.stringify(audit)).not.toContain(token);
  });

  it("keeps the existing connection when Meta refuses a replacement token", async () => {
    await connect().expect(200);
    const before = await prisma.metaDataset.findUniqueOrThrow({ where: { projectId } });
    fetcher.mockResolvedValue(new Response(JSON.stringify({ error: { code: 190, message: "Error validating access token" } }), { status: 400 }));

    const response = await connect({ datasetId: "1234567890", token: "replacement-token" });

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual([{ code: "TOKEN" }]);
    expect(await prisma.metaDataset.findUniqueOrThrow({ where: { projectId } })).toEqual(before);
  });

  it("changes the test code and the currency without a token or a call to Meta, but needs a token for another dataset", async () => {
    await connect().expect(200);
    fetcher.mockClear();

    const changed = await connect({ datasetId: "1234567890", testEventCode: "TEST9", currency: "USD" }).expect(200);
    expect(changed.body.dataset).toMatchObject({ testEventCode: "TEST9", currency: "USD", datasetName: "Пиксель клиента" });
    expect(fetcher).not.toHaveBeenCalled();

    await connect({ datasetId: "999999999" }).expect(400);
    expect((await prisma.metaDataset.findUniqueOrThrow({ where: { projectId } })).datasetId).toBe("1234567890");
  });

  it("asks for the currency when the project has none", async () => {
    await prisma.project.update({ where: { id: projectId }, data: { budgetCurrency: null } });
    await connect().expect(400);
    await connect({ datasetId: "1234567890", token, currency: "EUR" }).expect(200);
  });

  it("refuses malformed settings", async () => {
    await connect({ datasetId: "act_123", token }).expect(400);
    await connect({ datasetId: "1234567890", token, currency: "rub" }).expect(400);
    await connect({ datasetId: "1234567890" }).expect(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("answers 403 to clients and guests and 404 to strangers, before contacting Meta", async () => {
    const customer = await signInAs("Customer", { role: "CLIENT" });
    await grantAccess(customer.membership!.id, clientId);
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);
    for (const member of [customer, guest]) {
      await request(app).get(path()).set(member.auth).expect(403);
      await connect(undefined, member.auth).expect(403);
      await request(app).delete(path()).set(member.auth).expect(403);
    }
    await request(app).get(path(MISSING)).set(auth).expect(404);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("disconnects, dropping waiting events and keeping the record of those sent", async () => {
    await connect().expect(200);
    const lead = await formLead("Анна", "111");
    const event = await prisma.crmConversionEvent.create({ data: { orgId, projectId, name: "Квал", nameKey: "квал", stages: ["QUALIFIED"] } });
    const other = await prisma.crmConversionEvent.create({ data: { orgId, projectId, name: "Замер", nameKey: "замер", stages: ["TARGET"] } });
    const third = await prisma.crmConversionEvent.create({ data: { orgId, projectId, name: "Продажа", nameKey: "продажа", stages: ["PROPOSAL"] } });
    const base = { orgId, projectId, leadId: lead.id, reachedAt: new Date(), nextAttemptAt: new Date() };
    await prisma.metaConversionSend.createMany({ data: [
      { ...base, eventId: event.id, eventName: "Квал", status: "SENT", sentAt: new Date() },
      { ...base, eventId: other.id, eventName: "Замер", status: "PENDING" },
      { ...base, eventId: third.id, eventName: "Продажа", status: "WAITING_AMOUNT" },
    ] });

    await request(app).delete(path()).set(auth).expect(204);

    expect(await prisma.metaDataset.findUnique({ where: { projectId } })).toBeNull();
    expect((await prisma.metaConversionSend.findMany()).map((send) => send.status)).toEqual(["SENT"]);
    await request(app).delete(path()).set(auth).expect(404);
    expect((await request(app).get(path()).set(auth).expect(200)).body).toMatchObject({ dataset: null, recent: [{ eventName: "Квал", status: "SENT" }] });
  });

  it("queues the events form leads reached during the previous seven days when a dataset is connected", async () => {
    const qual = await prisma.crmConversionEvent.create({ data: { orgId, projectId, name: "Квал", nameKey: "квал", stages: ["QUALIFIED"] } });
    const now = Date.now();
    for (let index = 0; index < 5; index++) {
      const lead = await formLead(`Свежий ${index}`, `10${index}`);
      await enters(lead.id, "QUALIFIED", new Date(now - (index + 1) * DAY));
    }
    for (let index = 0; index < 2; index++) {
      const lead = await formLead(`Старый ${index}`, `20${index}`);
      await enters(lead.id, "QUALIFIED", new Date(now - 10 * DAY));
    }
    const manual = await prisma.lead.create({ data: { orgId, projectId, name: "Вручную", stage: "NEW", position: 0 } });
    await enters(manual.id, "QUALIFIED", new Date(now - DAY));

    await connect().expect(200);

    const queued = await prisma.metaConversionSend.findMany({ include: { lead: true }, orderBy: { reachedAt: "desc" } });
    expect(queued.map((send) => send.lead.name)).toEqual(["Свежий 0", "Свежий 1", "Свежий 2", "Свежий 3", "Свежий 4"]);
    expect(queued.every((send) => send.eventId === qual.id && send.status === "PENDING")).toBe(true);
    expect(queued[0]!.reachedAt.getTime()).toBe(now - DAY);
  });

  it("counts the events sent today, over 7 and over 30 days in the Meta account's time zone and lists the latest", async () => {
    await connect().expect(200);
    const event = await prisma.crmConversionEvent.create({ data: { orgId, projectId, name: "Квал", nameKey: "квал", stages: ["QUALIFIED"] } });
    const today = localDate(new Date(), "Europe/Minsk");
    const noonMinsk = (daysAgo: number) => {
      const date = new Date(`${today}T09:00:00Z`);
      date.setUTCDate(date.getUTCDate() - daysAgo);
      return date;
    };
    for (const [index, daysAgo] of [0, 3, 20, 40].entries()) {
      const lead = await formLead(`Лид ${daysAgo}`, `30${index}`);
      await prisma.metaConversionSend.create({ data: {
        orgId, projectId, leadId: lead.id, eventId: event.id, eventName: "Квал",
        reachedAt: noonMinsk(daysAgo), sentAt: noonMinsk(daysAgo), nextAttemptAt: noonMinsk(daysAgo), status: "SENT",
      } });
    }
    const failed = await formLead("Отказ", "399");
    await prisma.metaConversionSend.create({ data: {
      orgId, projectId, leadId: failed.id, eventId: event.id, eventName: "Квал",
      reachedAt: new Date(noonMinsk(0).getTime() + 60_000), nextAttemptAt: new Date(), status: "FAILED", lastError: "Неверное значение event_time",
    } });

    const body = (await request(app).get(path()).set(auth).expect(200)).body;

    expect(body.counts).toEqual({ today: 1, week: 2, month: 3 });
    expect(body.recent.map((send: { leadName: string; status: string; lastError: string | null }) => [send.leadName, send.status, send.lastError])).toEqual([
      ["Отказ", "FAILED", "Неверное значение event_time"],
      ["Лид 0", "SENT", null],
      ["Лид 3", "SENT", null],
      ["Лид 20", "SENT", null],
      ["Лид 40", "SENT", null],
    ]);
  });
});
