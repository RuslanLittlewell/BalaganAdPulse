import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Tariff } from "@adpulse/access-policy";
import { createApp } from "../../src/composition/app.js";
import { createContainer } from "../../src/composition/create-container.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { SystemClock } from "../../src/shared/infrastructure/clock.js";
import { createOnboardingRouter, createOnboardingUseCases } from "../../src/modules/onboarding/index.js";
import { PrismaOnboardingMarks, PrismaOnboardingReader } from "../../src/modules/onboarding/infrastructure/prisma-onboarding.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs, signInAsPlatformAdmin } from "../helpers/auth.js";

const app = createApp();
let telegramLinked = false;
const withBot = createApp({
  container: {
    ...createContainer(),
    onboardingRouter: createOnboardingRouter(createOnboardingUseCases({
      reader: new PrismaOnboardingReader(prisma, new SystemClock()),
      marks: new PrismaOnboardingMarks(prisma),
      telegram: { status: async () => ({ available: true, linked: telegramLinked }) },
      clock: new SystemClock(),
    })),
  },
});

beforeEach(async () => { await resetDb(); telegramLinked = false; });
afterAll(async () => { await prisma.$disconnect(); });

const onboarding = (auth: { Authorization: string }, target = app) =>
  request(target).get("/api/onboarding").set(auth);

const stepsOf = async (auth: { Authorization: string }, target = app) =>
  Object.fromEntries((await onboarding(auth, target)).body.steps.map(({ key, done }: { key: string; done: boolean }) => [key, done]));

async function onTariff(tariff: Tariff) {
  await prisma.organization.update({ where: { id: (await currentOrg()).id }, data: { tariff } });
}

describe("an admin's first steps", () => {
  it("lists five undone steps for a fresh organization without a bot, and no first project", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });

    const res = await onboarding(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      welcomed: false,
      hidden: false,
      steps: [
        { key: "client", done: false },
        { key: "project", done: false },
        { key: "adAccount", done: false },
        { key: "team", done: false },
        { key: "kpi", done: false },
      ],
      firstProjectId: null,
    });
  });

  it("ticks each step from the organization's data and names the first project", async () => {
    const { auth, user } = await signInAs("Admin", { role: "ADMIN" });
    const { projectId } = await seedProject(user.id, "Acme");
    await seedProject(user.id, "Globex");
    await prisma.projectIntegration.create({
      data: { projectId, accountId: "111", currency: "BYN", timezone: "UTC", encryptedToken: "enc", revision: "v1", nextDailyAt: new Date() },
    });
    await signInAs("Colleague", { role: "MANAGER" });
    await prisma.organization.update({
      where: { id: (await currentOrg()).id }, data: { kpiMetric: "CONVERSIONS", kpiTarget: 100 },
    });

    const res = await onboarding(auth);

    expect(res.body.steps.every((step: { done: boolean }) => step.done)).toBe(true);
    expect(res.body.firstProjectId).toBe(projectId);
  });

  it("counts a pending employee invitation, and not a revoked one or one for a client", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    const orgId = (await currentOrg()).id;
    await prisma.invite.createMany({
      data: [
        { orgId, code: "REVOKED1", role: "MANAGER", revokedAt: new Date() },
        { orgId, code: "CLIENTX1", registrationType: "CLIENT", role: null },
      ],
    });
    expect((await stepsOf(auth)).team).toBe(false);

    await prisma.invite.create({ data: { orgId, code: "PENDING1", role: "MANAGER" } });

    expect((await stepsOf(auth)).team).toBe(true);
  });

  it("does not count a client's account as an employee", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    await signInAs("Client", { role: "CLIENT" });

    expect((await stepsOf(auth)).team).toBe(false);
  });

  it("leaves out inviting an employee when the tariff allows one user", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    await onTariff("SOLO");

    expect(Object.keys(await stepsOf(auth))).toEqual(["client", "project", "adAccount", "kpi"]);
  });

  it("adds the bot when it is offered and ticks it once linked", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });

    expect((await stepsOf(auth, withBot)).telegram).toBe(false);
    telegramLinked = true;
    expect((await stepsOf(auth, withBot)).telegram).toBe(true);
  });
});

describe("other roles' steps", () => {
  it("gives a manager the profile, done once a phone is saved", async () => {
    const { auth, user } = await signInAs("Manager", { role: "MANAGER" });
    expect(await stepsOf(auth)).toEqual({ profile: false });

    await prisma.user.update({ where: { id: user.id }, data: { phone: "+375 29 000-00-00" } });

    expect(await stepsOf(auth)).toEqual({ profile: true });
    expect(await stepsOf(auth, withBot)).toEqual({ profile: true, telegram: false });
  });

  it("reads a Telegram name as a filled-in profile", async () => {
    const { auth, user } = await signInAs("Manager", { role: "MANAGER" });
    await prisma.user.update({ where: { id: user.id }, data: { telegram: "@anna" } });

    expect((await stepsOf(auth)).profile).toBe(true);
  });

  it.each(["GUEST", "CLIENT"] as const)("gives a %s no steps but still a welcome", async (role) => {
    const { auth } = await signInAs(role, { role });

    const res = await onboarding(auth, withBot);

    expect(res.body).toMatchObject({ welcomed: false, steps: [] });
  });
});

describe("the welcome and hiding", () => {
  it("records the welcome once and keeps the first time", async () => {
    const { auth, membership } = await signInAs("Admin", { role: "ADMIN" });

    expect((await request(app).post("/api/onboarding/welcome").set(auth)).status).toBe(204);
    const first = (await prisma.membership.findUniqueOrThrow({ where: { id: membership!.id } })).welcomedAt;
    expect((await request(app).post("/api/onboarding/welcome").set(auth)).status).toBe(204);

    expect((await onboarding(auth)).body.welcomed).toBe(true);
    expect((await prisma.membership.findUniqueOrThrow({ where: { id: membership!.id } })).welcomedAt).toEqual(first);
  });

  it("hides the list for that membership only", async () => {
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const other = await signInAs("Second admin", { role: "ADMIN" });

    expect((await request(app).post("/api/onboarding/hide").set(admin.auth)).status).toBe(204);

    expect((await onboarding(admin.auth)).body.hidden).toBe(true);
    expect((await onboarding(other.auth)).body.hidden).toBe(false);
  });

  it("works while the trial has ended", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    await prisma.organization.update({
      where: { id: (await currentOrg()).id },
      data: { tariff: "TRIAL", trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    expect((await request(app).post("/api/onboarding/welcome").set(auth)).status).toBe(204);
    expect((await request(app).post("/api/onboarding/hide").set(auth)).status).toBe(204);
    expect((await onboarding(auth)).status).toBe(200);
  });
});

describe("who reaches onboarding", () => {
  it("refuses a caller without a session -> 401", async () => {
    expect((await request(app).get("/api/onboarding")).status).toBe(401);
    expect((await request(app).post("/api/onboarding/welcome")).status).toBe(401);
  });

  it("refuses the platform administrator -> 403", async () => {
    const { auth } = await signInAsPlatformAdmin();
    expect((await onboarding(auth)).status).toBe(403);
    expect((await request(app).post("/api/onboarding/hide").set(auth)).status).toBe(403);
  });

  it("refuses a member of a suspended organization -> 403", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    await prisma.organization.update({ where: { id: (await currentOrg()).id }, data: { status: "SUSPENDED" } });

    expect((await onboarding(auth)).status).toBe(403);
  });
});
