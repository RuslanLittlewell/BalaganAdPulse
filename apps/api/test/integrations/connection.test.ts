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
const path = () => `/api/projects/${projectId}/integrations/meta`;
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
it("normalizes account ID, encrypts tokens and queues without changing existing data", async () => {
  const campaign = await seedCampaign(projectId);
  const response = await request(app).put(path()).set(auth).send({ accountId: "act_123", token });
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ accountId: "123", status: "QUEUED" });
  expect(JSON.stringify(response.body)).not.toContain(token);
  const stored = await prisma.projectIntegration.findUniqueOrThrow({ where: { projectId } });
  expect(stored.encryptedToken).not.toContain(token);
  expect(stored.encryptedToken).not.toBe(token);
  expect(await prisma.campaign.findUnique({ where: { id: campaign.id } })).not.toBeNull();
  const read = await request(app).get(path()).set(auth);
  expect(JSON.stringify(read.body)).not.toContain(stored.encryptedToken);
  expect(JSON.stringify(await prisma.auditEvent.findMany())).not.toContain(token);
});
it("does not replace a working connection when Meta rejects a token", async () => {
  await request(app).put(path()).set(auth).send({ accountId: "123", token });
  const before = await prisma.projectIntegration.findUniqueOrThrow({ where: { projectId } });
  fetcher.mockResolvedValue(new Response(JSON.stringify({ error: { code: 190, message: token } }), { status: 400 }));
  const response = await request(app).put(path()).set(auth).send({ accountId: "123", token: "replacement" });
  expect(response.status).toBe(400);
  expect(JSON.stringify(response.body)).not.toContain(token);
  expect(await prisma.projectIntegration.findUnique({ where: { projectId } })).toEqual(before);
});
it("checks project reach and permission before contacting Meta", async () => {
  const guest = await signInAs("Guest", { role: "GUEST" });
  await grantAccess(guest.membership!.id, clientId);
  for (const method of ["get", "put", "delete"] as const) {
    expect((await request(app)[method](path()).set(guest.auth).send({ accountId: "123", token })).status).toBe(403);
  }
  const stranger = await signInAs("Stranger", { role: "MANAGER" });
  expect((await request(app).get(path()).set(stranger.auth)).status).toBe(404);
  expect(fetcher).not.toHaveBeenCalled();
});
it("rejects malformed IDs and missing encryption configuration", async () => {
  expect((await request(app).put(path()).set(auth).send({ accountId: "https://other", token })).status).toBe(400);
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", "");
  app = createApp();
  expect((await request(app).put(path()).set(auth).send({ accountId: "123", token })).status).toBe(400);
  expect(await prisma.projectIntegration.count()).toBe(0);
});
it("disconnects without deleting imported data", async () => {
  const campaign = await seedCampaign(projectId);
  await request(app).put(path()).set(auth).send({ accountId: "123", token });
  expect((await request(app).delete(path()).set(auth)).status).toBe(204);
  expect(await prisma.projectIntegration.count()).toBe(0);
  expect(await prisma.campaign.findUnique({ where: { id: campaign.id } })).not.toBeNull();
});
it("coalesces manual requests and allows an explicit retry after token failure", async () => {
  await request(app).put(path()).set(auth).send({ accountId: "123", token });
  await prisma.projectIntegration.update({ where: { projectId }, data: { status: "AUTH_REQUIRED", queuedAt: null, lastError: "TOKEN" } });
  const responses = await Promise.all([request(app).post(`${path()}/sync`).set(auth), request(app).post(`${path()}/sync`).set(auth)]);
  expect(responses.map((response) => response.status)).toEqual([202, 202]);
  expect(await prisma.projectIntegration.findUnique({ where: { projectId } })).toMatchObject({ status: "QUEUED", lastError: null });
  expect(await prisma.projectIntegration.count()).toBe(1);
  const guest = await signInAs("Reader", { role: "GUEST" });
  await grantAccess(guest.membership!.id, clientId);
  expect((await request(app).post(`${path()}/sync`).set(guest.auth)).status).toBe(403);
});
