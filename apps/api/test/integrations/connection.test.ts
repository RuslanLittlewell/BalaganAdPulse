import { beforeEach, afterEach, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject, seedCampaign } from "../helpers/db.js";
import { signInAs, grantAccess } from "../helpers/auth.js";

let app: ReturnType<typeof createApp>;
let auth: { Authorization: string };
let projectId: string;
let clientId: string;
let fetcher: ReturnType<typeof vi.fn>;
const token = "synthetic-meta-token";
const list = () => `/api/projects/${projectId}/integrations`;
const one = (id: string) => `${list()}/${id}`;
const MISSING = "00000000-0000-4000-8000-000000000000";
beforeEach(async () => {
  await resetDb();
  const admin = await signInAs();
  auth = admin.auth;
  ({ projectId, clientId } = await seedProject(admin.user.id));
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ account_id: "123", currency: "BYN", timezone_name: "Europe/Warsaw" })));
  vi.stubGlobal("fetch", fetcher);
  app = createApp();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const connect = (body: { accountId: string; token: string }, as = auth) =>
  request(app).post(`${list()}/meta`).set(as).send(body);
const billedIn = (currency: string, accountId = "123") =>
  fetcher.mockResolvedValue(new Response(JSON.stringify({ account_id: accountId, currency, timezone_name: "Europe/Warsaw" })));
const withFiguresIn = async (currency: string) => {
  await prisma.project.update({ where: { id: projectId }, data: { budgetCurrency: currency } });
  const campaign = await seedCampaign(projectId);
  await prisma.campaignDailyMetric.create({ data: { campaignId: campaign.id, date: new Date("2026-09-01"), spend: "10" } });
};
it("normalizes account ID, encrypts tokens and queues without changing existing data", async () => {
  const campaign = await seedCampaign(projectId);
  const response = await connect({ accountId: "act_123", token });
  expect(response.status).toBe(201);
  expect(response.body).toMatchObject({ provider: "META", accountId: "123", status: "QUEUED", leadsEnabled: true });
  expect(JSON.stringify(response.body)).not.toContain(token);
  const stored = await prisma.projectIntegration.findFirstOrThrow({ where: { projectId } });
  expect(stored.encryptedToken).not.toContain(token);
  expect(stored.encryptedToken).not.toBe(token);
  expect(await prisma.campaign.findUnique({ where: { id: campaign.id } })).not.toBeNull();
  const read = await request(app).get(list()).set(auth);
  expect(read.body).toEqual([expect.objectContaining({ id: stored.id, accountId: "123" })]);
  expect(JSON.stringify(read.body)).not.toContain(stored.encryptedToken);
  expect(JSON.stringify(await prisma.auditEvent.findMany())).not.toContain(token);
});
it("does not replace a working connection when Meta rejects a token", async () => {
  const { body: created } = await connect({ accountId: "123", token });
  const before = await prisma.projectIntegration.findFirstOrThrow({ where: { projectId } });
  fetcher.mockResolvedValue(new Response(JSON.stringify({ error: { code: 190, message: token } }), { status: 400 }));
  const response = await request(app).put(one(created.id)).set(auth).send({ accountId: "123", token: "replacement" });
  expect(response.status).toBe(400);
  expect(JSON.stringify(response.body)).not.toContain(token);
  expect(await prisma.projectIntegration.findFirst({ where: { projectId } })).toEqual(before);
});
it("checks project reach and permission before contacting Meta", async () => {
  const guest = await signInAs("Guest", { role: "GUEST" });
  await grantAccess(guest.membership!.id, clientId);
  expect((await request(app).get(list()).set(guest.auth)).status).toBe(403);
  expect((await connect({ accountId: "123", token }, guest.auth)).status).toBe(403);
  for (const method of ["put", "patch", "delete"] as const) {
    expect((await request(app)[method](one(MISSING)).set(guest.auth).send({ accountId: "123", token, leadsEnabled: false })).status).toBe(403);
  }
  const stranger = await signInAs("Stranger", { role: "MANAGER" });
  expect((await request(app).get(list()).set(stranger.auth)).status).toBe(404);
  expect((await request(app).delete(one(MISSING)).set(auth)).status).toBe(404);
  expect(fetcher).not.toHaveBeenCalled();
});
it("rejects malformed IDs and missing encryption configuration", async () => {
  expect((await connect({ accountId: "https://other", token })).status).toBe(400);
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", "");
  app = createApp();
  expect((await connect({ accountId: "123", token })).status).toBe(400);
  expect(await prisma.projectIntegration.count()).toBe(0);
});
it("disconnects without deleting imported data", async () => {
  const campaign = await seedCampaign(projectId);
  const { body: created } = await connect({ accountId: "123", token });
  expect((await request(app).delete(one(created.id)).set(auth)).status).toBe(204);
  expect(await prisma.projectIntegration.count()).toBe(0);
  expect(await prisma.campaign.findUnique({ where: { id: campaign.id } })).not.toBeNull();
});
it("coalesces manual requests and allows an explicit retry after token failure", async () => {
  const { body: created } = await connect({ accountId: "123", token });
  await prisma.projectIntegration.updateMany({ where: { projectId }, data: { status: "AUTH_REQUIRED", queuedAt: null, lastError: "TOKEN" } });
  const sync = (as = auth) => request(app).post(`${one(created.id)}/sync`).set(as);
  const responses = await Promise.all([sync(), sync()]);
  expect(responses.map((response) => response.status)).toEqual([202, 202]);
  expect(await prisma.projectIntegration.findFirst({ where: { projectId } })).toMatchObject({ status: "QUEUED", lastError: null });
  expect(await prisma.projectIntegration.count()).toBe(1);
  const guest = await signInAs("Reader", { role: "GUEST" });
  await grantAccess(guest.membership!.id, clientId);
  expect((await sync(guest.auth)).status).toBe(403);
});
it("gives a project with no currency the account's currency", async () => {
  billedIn("USD");
  expect((await connect({ accountId: "123", token })).status).toBe(201);
  expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).budgetCurrency).toBe("USD");
});
it("replaces the currency of a project that holds no figures yet", async () => {
  await prisma.project.update({ where: { id: projectId }, data: { budgetCurrency: "EUR" } });
  billedIn("PLN");
  expect((await connect({ accountId: "123", token })).status).toBe(201);
  expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).budgetCurrency).toBe("PLN");
});
it("refuses an account billed in another currency than the figures the project holds", async () => {
  await withFiguresIn("EUR");
  billedIn("USD");
  const response = await connect({ accountId: "123", token });
  expect(response.status).toBe(400);
  expect(response.body.error.details).toEqual([{ code: "CURRENCY" }]);
  expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).budgetCurrency).toBe("EUR");
  expect(await prisma.projectIntegration.findFirst({ where: { projectId } })).toBeNull();
});
it("connects an account billed in the currency of the figures already held", async () => {
  await withFiguresIn("USD");
  billedIn("USD");
  expect((await connect({ accountId: "123", token })).status).toBe(201);
});
it("holds a second account of the same currency beside the first", async () => {
  billedIn("USD", "123");
  await connect({ accountId: "123", token });
  billedIn("USD", "456");
  expect((await connect({ accountId: "456", token })).status).toBe(201);

  const listed = await request(app).get(list()).set(auth);
  expect(listed.body.map((connection: { accountId: string }) => connection.accountId)).toEqual(["123", "456"]);
});
it("refuses the same account twice with 409", async () => {
  await connect({ accountId: "123", token });
  billedIn("BYN");
  const again = await connect({ accountId: "act_123", token });
  expect(again.status).toBe(409);
  expect(await prisma.projectIntegration.count()).toBe(1);
});
it("refuses a second account billed in another currency", async () => {
  billedIn("USD", "123");
  await connect({ accountId: "123", token });
  billedIn("EUR", "456");
  const response = await connect({ accountId: "456", token });
  expect(response.status).toBe(400);
  expect(response.body.error.details).toEqual([{ code: "CURRENCY" }]);
  expect(await prisma.projectIntegration.count()).toBe(1);
  expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).budgetCurrency).toBe("USD");
});
it("disconnects one account and keeps the other importing", async () => {
  billedIn("BYN", "123");
  const { body: first } = await connect({ accountId: "123", token });
  billedIn("BYN", "456");
  const { body: second } = await connect({ accountId: "456", token });

  expect((await request(app).delete(one(first.id)).set(auth)).status).toBe(204);

  const listed = await request(app).get(list()).set(auth);
  expect(listed.body).toEqual([expect.objectContaining({ id: second.id, accountId: "456" })]);
});
it("switches a connection's lead import off and on", async () => {
  const { body: created } = await connect({ accountId: "123", token });

  const off = await request(app).patch(one(created.id)).set(auth).send({ leadsEnabled: false });
  expect(off.status).toBe(200);
  expect(off.body.leadsEnabled).toBe(false);
  expect((await request(app).patch(one(created.id)).set(auth).send({ leadsEnabled: "no" })).status).toBe(400);

  const on = await request(app).patch(one(created.id)).set(auth).send({ leadsEnabled: true });
  expect(on.body.leadsEnabled).toBe(true);
  expect((await prisma.projectIntegration.findUniqueOrThrow({ where: { id: created.id } })).leadsQueuedAt).not.toBeNull();
});
it("adds a connection with lead import off when asked, and on otherwise", async () => {
  const off = await request(app).post(`${list()}/meta`).set(auth).send({ accountId: "123", token, leadsEnabled: false });
  expect(off.status).toBe(201);
  expect(off.body.leadsEnabled).toBe(false);

  billedIn("BYN", "456");
  const on = await connect({ accountId: "456", token });
  expect(on.body.leadsEnabled).toBe(true);
});
