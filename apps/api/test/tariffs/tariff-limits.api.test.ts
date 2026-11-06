import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Tariff } from "@adpulse/access-policy";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { AesCredentialCipher } from "../../src/modules/integrations/infrastructure/credential-cipher.js";
import { limitReached, TRIAL_ENDED } from "../../src/modules/tariffs/index.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs, signInAsPlatformAdmin } from "../helpers/auth.js";

const app = createApp();
const DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

async function onTariff(tariff: Tariff, trialEndsAt: Date | null = null) {
  await prisma.organization.update({ where: { id: (await currentOrg()).id }, data: { tariff, trialEndsAt } });
}

async function seedProjects(ownerId: string, count: number) {
  const seeded = [];
  for (let index = 0; index < count; index += 1) seeded.push(await seedProject(ownerId, `Client ${index + 1}`));
  return seeded;
}

async function seedIntegration(projectId: string, accountId: string) {
  await prisma.projectIntegration.create({
    data: {
      projectId, accountId, currency: "BYN", timezone: "UTC",
      encryptedToken: new AesCredentialCipher(process.env.INTEGRATION_ENCRYPTION_KEY).encrypt("token", projectId),
      revision: "v1", nextDailyAt: new Date(),
    },
  });
}

const refusal = (resource: Parameters<typeof limitReached>[0], limit: number) =>
  ({ error: { message: limitReached(resource, limit), details: [{ code: "TARIFF_LIMIT", resource, limit }] } });

describe("creating a record over a tariff limit", () => {
  it("refuses a sixth project on Solo and stores nothing", async () => {
    const { auth, user } = await signInAs("Admin", { role: "ADMIN" });
    const [{ clientId }] = await seedProjects(user.id, 5);
    await onTariff("SOLO");

    const res = await request(app).post("/api/projects").set(auth).send({ clientId, name: "Sixth" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual(refusal("projects", 5));
    expect(await prisma.project.count()).toBe(5);
  });

  it("refuses a second client on Business", async () => {
    const { auth, user } = await signInAs("Admin", { role: "ADMIN" });
    await seedProject(user.id);
    await onTariff("BUSINESS");

    const res = await request(app).post("/api/clients").set(auth).send({ name: "Second" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual(refusal("clients", 1));
    expect(await prisma.client.count()).toBe(1);
  });

  it("counts a pending invitation as a user", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    await signInAs("Colleague", { role: "MANAGER" });
    await onTariff("BUSINESS");

    const third = await request(app).post("/api/invites").set(auth).send({ registrationType: "EMPLOYEE", role: "ADMIN" });
    const fourth = await request(app).post("/api/invites").set(auth).send({ registrationType: "EMPLOYEE", role: "ADMIN" });

    expect(third.status).toBe(201);
    expect(fourth.status).toBe(403);
    expect(fourth.body).toEqual(refusal("users", 3));
  });

  it("does not count a revoked or expired invitation", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    await onTariff("SOLO");
    await prisma.invite.createMany({
      data: [
        { orgId: (await currentOrg()).id, code: "REVOKED1", role: "MANAGER", revokedAt: new Date() },
        { orgId: (await currentOrg()).id, code: "EXPIRED1", role: "MANAGER", expiresAt: new Date(Date.now() - DAY) },
      ],
    });

    const res = await request(app).post("/api/invites").set(auth).send({ registrationType: "EMPLOYEE", role: "ADMIN" });

    expect(res.status).toBe(403);
    expect(await prisma.membership.count()).toBe(1);
  });

  it("refuses a fourth ad account on Business before reaching the provider", async () => {
    const { auth, user } = await signInAs("Admin", { role: "ADMIN" });
    const { projectId } = await seedProject(user.id);
    for (const accountId of ["111", "222", "333"]) await seedIntegration(projectId, accountId);
    await onTariff("BUSINESS");

    const res = await request(app).post(`/api/projects/${projectId}/integrations/meta`).set(auth)
      .send({ accountId: "444", token: "token" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual(refusal("adAccounts", 3));
    expect(await prisma.projectIntegration.count()).toBe(3);
  });

  it("keeps records above a lower limit readable and editable after a downgrade", async () => {
    const { auth, user } = await signInAs("Admin", { role: "ADMIN" });
    const seeded = await seedProjects(user.id, 8);
    await onTariff("SOLO");

    const listed = await request(app).get("/api/projects").set(auth);
    const renamed = await request(app).patch(`/api/projects/${seeded[0]!.projectId}`).set(auth).send({ name: "Renamed" });
    const ninth = await request(app).post("/api/projects").set(auth).send({ clientId: seeded[0]!.clientId, name: "Ninth" });

    expect(listed.body).toHaveLength(8);
    expect(renamed.status).toBe(200);
    expect(ninth.status).toBe(403);
  });

  it("sets no limit on Enterprise", async () => {
    const { auth, user } = await signInAs("Admin", { role: "ADMIN" });
    const [{ clientId }] = await seedProjects(user.id, 41);

    const res = await request(app).post("/api/projects").set(auth).send({ clientId, name: "Forty-second" });

    expect(res.status).toBe(201);
  });
});

describe("an expired trial", () => {
  it("refuses writes and keeps reads", async () => {
    const { auth, user } = await signInAs("Admin", { role: "ADMIN" });
    const { projectId } = await seedProject(user.id);
    await onTariff("TRIAL", new Date(Date.now() - DAY));

    const task = await request(app).post("/api/tasks").set(auth).send({ projectId, title: "Brief", priority: "MEDIUM" });
    const projects = await request(app).get("/api/projects").set(auth);

    expect(task.status).toBe(403);
    expect(task.body).toEqual({ error: { message: TRIAL_ENDED, details: [{ code: "TRIAL_ENDED" }] } });
    expect(await prisma.task.count()).toBe(0);
    expect(projects.status).toBe(200);
    expect(projects.body).toHaveLength(1);
  });

  it("lets a running trial write", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    await onTariff("TRIAL", new Date(Date.now() + DAY));

    expect((await request(app).post("/api/clients").set(auth).send({ name: "Acme" })).status).toBe(201);
  });

  it("writes again once the platform administrator assigns a tariff", async () => {
    const platform = await signInAsPlatformAdmin();
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    await onTariff("TRIAL", new Date(Date.now() - DAY));
    expect((await request(app).post("/api/clients").set(auth).send({ name: "Acme" })).status).toBe(403);

    const assigned = await request(app).patch(`/api/platform/organizations/${(await currentOrg()).id}`)
      .set(platform.auth).send({ tariff: "BUSINESS" });

    expect(assigned.body).toMatchObject({ tariff: "BUSINESS", trialEndsAt: null });
    expect((await request(app).post("/api/clients").set(auth).send({ name: "Acme" })).status).toBe(201);
  });
});

describe("the session's tariff", () => {
  it("reports the tariff, its limits and the current usage", async () => {
    const { auth, user } = await signInAs("Admin", { role: "ADMIN" });
    await seedProjects(user.id, 4);
    await onTariff("AGENCY");

    const res = await request(app).get("/api/auth/me").set(auth);

    expect(res.body.tariff).toEqual({
      tariff: "AGENCY",
      trialEndsAt: null,
      trialExpired: false,
      limits: { projects: 15, clients: 15, users: 5, adAccounts: null },
      usage: { projects: 4, clients: 4, users: 1, adAccounts: 0 },
    });
  });

  it("names the trial end and whether it has passed", async () => {
    const { auth } = await signInAs("Member", { role: "MANAGER" });
    const trialEndsAt = new Date(Date.now() - DAY);
    await onTariff("TRIAL", trialEndsAt);

    const res = await request(app).get("/api/auth/me").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.tariff).toMatchObject({ tariff: "TRIAL", trialEndsAt: trialEndsAt.toISOString(), trialExpired: true });
  });
});
