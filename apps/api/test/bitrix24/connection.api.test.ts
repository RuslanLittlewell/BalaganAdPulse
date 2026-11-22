import dns from "node:dns";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { Bitrix24Error, resetBitrix24WebhookLimit } from "../../src/modules/bitrix24/index.js";
import { Bitrix24RestClient } from "../../src/modules/bitrix24/infrastructure/bitrix24-rest-client.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs } from "../helpers/auth.js";
import { FakePortal } from "./fake-portal.js";

const app = createApp();
const WEBHOOK = "https://acme.bitrix24.ru/rest/1/abc123def/";
const CONNECTION = "/api/bitrix24/connection";
let portal: FakePortal;
let admin: { Authorization: string };
let reserved = false;

beforeEach(async () => {
  await resetDb();
  resetBitrix24WebhookLimit();
  portal = new FakePortal();
  reserved = false;
  vi.spyOn(Bitrix24RestClient.prototype, "call").mockImplementation((method, params) => portal.call(method, params));
  vi.spyOn(Bitrix24RestClient.prototype, "list").mockImplementation((method, params) => portal.list(method, params));
  vi.spyOn(dns.promises, "lookup").mockImplementation((async () => [{ address: reserved ? "10.0.0.5" : "93.184.216.34", family: 4 }]) as never);
  admin = (await signInAs("Admin")).auth;
});
afterEach(() => { vi.restoreAllMocks(); });
afterAll(() => prisma.$disconnect());

const connect = (body: Record<string, unknown> = {}, auth = admin) =>
  request(app).post(CONNECTION).set(auth).send({ webhookUrl: WEBHOOK, applicationToken: "app-token", ...body });

describe("connecting a portal", () => {
  it("saves the connection and never returns the secrets", async () => {
    const res = await connect();

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ portalHost: "acme.bitrix24.ru", status: "ACTIVE", enabled: true, inboundProjectId: null });
    expect(res.body.webhookUrl).toMatch(/\/api\/integrations\/bitrix24\/[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(res.body)).not.toContain("abc123def");
    expect(JSON.stringify(res.body)).not.toContain("app-token");
    const stored = await prisma.bitrix24Connection.findFirstOrThrow();
    expect(stored.sealedWebhook).not.toContain("abc123def");
    expect(stored.tokenHash).not.toContain("app-token");
    expect((await request(app).get(CONNECTION).set(admin)).body).toEqual(res.body);
  });

  it("refuses an address the portal rejects and stores nothing", async () => {
    portal.failWith(new Bitrix24Error("AUTH", "INVALID_CREDENTIALS"), "profile");

    expect((await connect()).status).toBe(400);
    expect(await prisma.bitrix24Connection.count()).toBe(0);
  });

  it.each([
    ["an http address", "http://acme.bitrix24.ru/rest/1/abc123def/"],
    ["an IP address", "https://10.0.0.5/rest/1/abc123def/"],
    ["an address that is not a REST webhook", "https://acme.bitrix24.ru/crm/lead/"],
    ["an address with a port", "https://acme.bitrix24.ru:8443/rest/1/abc123def/"],
  ])("refuses %s without calling it", async (_label, webhookUrl) => {
    expect((await connect({ webhookUrl })).status).toBe(400);
    expect(portal.calls).toEqual([]);
  });

  it("refuses a host that resolves to a private network without calling it", async () => {
    reserved = true;

    expect((await connect()).status).toBe(400);
    expect(portal.calls).toEqual([]);
  });

  it("refuses a second connection", async () => {
    await connect();
    expect((await connect()).status).toBe(409);
  });

  it("is managed by an admin only", async () => {
    await connect();
    const manager = (await signInAs("Manager", { role: "MANAGER" })).auth;

    expect((await request(app).get(CONNECTION).set(manager)).status).toBe(403);
    expect((await connect({}, manager)).status).toBe(403);
    expect((await request(app).delete(CONNECTION).set(manager)).status).toBe(403);
  });

  it("is absent without the CRM module", async () => {
    await prisma.organization.update({ where: { id: (await currentOrg()).id }, data: { tariff: "SOLO" } });

    expect((await request(app).get(CONNECTION).set(admin)).status).toBe(404);
  });
});

describe("changing the connection", () => {
  it("switches off and on, keeping the links", async () => {
    await connect();
    const connection = await prisma.bitrix24Connection.findFirstOrThrow();
    await prisma.bitrix24Link.create({ data: { connectionId: connection.id, kind: "LEAD", localId: "l1", remoteId: "1", localSyncedAt: new Date() } });

    expect((await request(app).patch(CONNECTION).set(admin).send({ enabled: false })).body.enabled).toBe(false);
    expect((await request(app).patch(CONNECTION).set(admin).send({ enabled: true })).body.enabled).toBe(true);
    expect(await prisma.bitrix24Link.count()).toBe(1);
  });

  it("takes only a project of the organization for inbound leads", async () => {
    await connect();
    const { projectId } = await seedProject("x");

    expect((await request(app).patch(CONNECTION).set(admin).send({ inboundProjectId: projectId })).body.inboundProjectId).toBe(projectId);
    expect((await request(app).patch(CONNECTION).set(admin).send({ inboundProjectId: "00000000-0000-4000-8000-000000000000" })).status).toBe(400);
  });

  it("replaces a revoked address and becomes active again", async () => {
    await connect();
    await prisma.bitrix24Connection.updateMany({ data: { status: "AUTH_REQUIRED", lastError: "AUTH" } });

    const res = await request(app).patch(CONNECTION).set(admin).send({ webhookUrl: "https://acme.bitrix24.ru/rest/1/newcode1/" });

    expect(res.body).toMatchObject({ status: "ACTIVE", lastError: null });
  });

  it("forgets the secrets and the links when removed", async () => {
    await connect();
    const connection = await prisma.bitrix24Connection.findFirstOrThrow();
    await prisma.bitrix24Link.create({ data: { connectionId: connection.id, kind: "LEAD", localId: "l1", remoteId: "1", localSyncedAt: new Date() } });

    expect((await request(app).delete(CONNECTION).set(admin)).status).toBe(204);
    expect(await prisma.bitrix24Connection.count()).toBe(0);
    expect(await prisma.bitrix24Link.count()).toBe(0);
    expect((await request(app).get(CONNECTION).set(admin)).body).toBeNull();
  });

  it("goes with its organization", async () => {
    await connect();
    const org = await prisma.organization.create({ data: { name: "Other", slug: "other" } });
    await prisma.bitrix24Connection.updateMany({ data: { orgId: org.id } });

    await prisma.organization.delete({ where: { id: org.id } });

    expect(await prisma.bitrix24Connection.count()).toBe(0);
  });
});

describe("stages and statuses", () => {
  it("lists the portal's statuses and maps stages to them", async () => {
    await connect();

    expect((await request(app).get("/api/bitrix24/statuses").set(admin)).body).toEqual([
      { id: "NEW", name: "Не обработан" }, { id: "IN_PROCESS", name: "В работе" }, { id: "PROCESSED", name: "Обработан" },
    ]);
    const res = await request(app).put("/api/bitrix24/stages").set(admin).send({ links: [{ stageKey: "NEW", statusId: "NEW" }, { stageKey: "TARGET", statusId: null }] });

    expect(res.status).toBe(200);
    expect(res.body.find((stage: { key: string }) => stage.key === "NEW")).toMatchObject({ statusId: "NEW", name: "Новый" });
    expect(res.body.find((stage: { key: string }) => stage.key === "TARGET")).toMatchObject({ statusId: null });
  });

  it("refuses one status for two stages, and an unknown stage", async () => {
    await connect();

    expect((await request(app).put("/api/bitrix24/stages").set(admin).send({ links: [{ stageKey: "NEW", statusId: "NEW" }, { stageKey: "TARGET", statusId: "NEW" }] })).status).toBe(400);
    expect((await request(app).put("/api/bitrix24/stages").set(admin).send({ links: [{ stageKey: "nope", statusId: "NEW" }] })).status).toBe(400);
  });
});

describe("runs", () => {
  it("starts one transfer and refuses a second while it runs", async () => {
    await connect();

    const first = await request(app).post("/api/bitrix24/runs").set(admin).send({ direction: "UPLOAD" });
    expect(first.status).toBe(202);
    expect(first.body).toMatchObject({ direction: "UPLOAD", state: "RUNNING", created: 0 });
    expect((await request(app).post("/api/bitrix24/runs").set(admin).send({ direction: "DOWNLOAD" })).status).toBe(409);
    expect((await request(app).get("/api/bitrix24/runs/latest").set(admin)).body).toMatchObject({ id: first.body.id });
  });
});

describe("the webhook", () => {
  const keyOf = async () => (await prisma.bitrix24Connection.findFirstOrThrow()).webhookKey;
  const send = (key: string, form: string) =>
    request(app).post(`/api/integrations/bitrix24/${key}`).type("form").send(form);
  const leadEvent = (token = "app-token", id = "42") =>
    `event=ONCRMLEADUPDATE&data[FIELDS][ID]=${id}&ts=1700000000&auth[domain]=acme.bitrix24.ru&auth[application_token]=${token}`;

  it("stores a valid event and answers 202", async () => {
    await connect();

    const res = await send(await keyOf(), leadEvent());

    expect(res.status).toBe(202);
    expect(await prisma.bitrix24Inbox.findMany({ select: { kind: true, remoteId: true } })).toEqual([{ kind: "LEAD", remoteId: "42" }]);
  });

  it("stores a task comment event with its task", async () => {
    await connect();

    await send(await keyOf(), "event=ONTASKCOMMENTADD&data[FIELDS_AFTER][ID]=9&data[FIELDS_AFTER][TASK_ID]=5&auth[application_token]=app-token");

    expect(await prisma.bitrix24Inbox.findMany({ select: { kind: true, remoteId: true } })).toEqual([{ kind: "COMMENT", remoteId: "5:9" }]);
  });

  it("answers a wrong token and an unknown key with the same 404", async () => {
    await connect();

    const wrong = await send(await keyOf(), leadEvent("other"));
    const unknown = await send("no-such-key", leadEvent());

    expect(wrong.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(wrong.body).toEqual(unknown.body);
    expect(await prisma.bitrix24Inbox.count()).toBe(0);
  });

  it("answers 429 to an address after 30 refused events in a minute", async () => {
    await connect();
    const statuses: number[] = [];
    for (let index = 0; index < 31; index++) {
      statuses.push((await send(`guess-${index}`, leadEvent()).set("X-Forwarded-For", "198.51.100.7")).status);
    }

    expect(statuses.slice(0, 30).every((status) => status === 404)).toBe(true);
    expect(statuses[30]).toBe(429);
    expect((await send(await keyOf(), leadEvent()).set("X-Forwarded-For", "198.51.100.8")).status).toBe(202);
  });

  it("ignores events while the connection is switched off", async () => {
    await connect();
    await request(app).patch(CONNECTION).set(admin).send({ enabled: false });

    expect((await send(await keyOf(), leadEvent())).status).toBe(202);
    expect(await prisma.bitrix24Inbox.count()).toBe(0);
  });

  it("limits the rate per address", async () => {
    await connect();
    const key = await keyOf();
    const statuses: number[] = [];
    for (let index = 0; index < 601; index++) statuses.push((await send(key, leadEvent("app-token", String(index)))).status);

    expect(statuses.slice(0, 600).every((status) => status === 202)).toBe(true);
    expect(statuses[600]).toBe(429);
  });
});
