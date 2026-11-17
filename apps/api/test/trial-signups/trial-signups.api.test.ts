import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { trialEndsAtFrom } from "@adpulse/access-policy";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { LogMailTransport, type MailMessage } from "../../src/shared/infrastructure/mail.js";
import { resetIdentityRateLimits } from "../../src/modules/identity/presentation/http/identity-http.js";
import { resetTrialSignupRateLimits } from "../../src/modules/trial-signups/index.js";
import { PrismaMembershipEnrolment } from "../../src/modules/members/infrastructure/prisma-membership-enrolment.js";
import { resetDb } from "../helpers/db.js";

const app = createApp();
const SIGNUPS = "/api/trial-signups";
const signup = {
  organizationName: "Acme Ads",
  name: "Olga",
  email: "olga@acme.com",
  password: "hunter2hunter2",
};
let sent: MailMessage[] = [];

beforeEach(async () => {
  await resetDb();
  resetIdentityRateLimits();
  resetTrialSignupRateLimits();
  sent = [];
  vi.spyOn(LogMailTransport.prototype, "send").mockImplementation(async (message) => { sent.push(message); });
});
afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => { await prisma.$disconnect(); });

const ask = (body: Record<string, unknown> = {}) => request(app).post(SIGNUPS).send({ ...signup, ...body });
const tokenOf = (message: MailMessage) => /\/trial\/confirm\/([0-9a-f]+)/.exec(message.text)![1];
const confirm = (token: string) => request(app).post(`${SIGNUPS}/${token}/confirm`);
const linkFor = async (body: Record<string, unknown> = {}) => {
  const before = sent.length;
  await ask(body);
  await vi.waitFor(() => expect(sent.length).toBe(before + 1));
  return tokenOf(sent[before]);
};
const registerElsewhere = (email: string) =>
  prisma.user.create({ data: { name: "Olga", email, passwordHash: "placeholder" } });

describe("POST /api/trial-signups", () => {
  it("accepts a new email, mails a link and creates nothing yet", async () => {
    const orgs = await prisma.organization.count();

    const res = await ask();

    expect(res.status).toBe(202);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].to).toBe(signup.email);
    expect(sent[0].text).toMatch(/^http:\/\/localhost:5173\/trial\/confirm\/[0-9a-f]{64}$/m);
    expect(sent[0].text).toContain("Acme Ads");
    expect(sent[0].text).toContain("24 часа");
    expect(await prisma.organization.count()).toBe(orgs);
    expect(await prisma.user.count({ where: { email: signup.email } })).toBe(0);
  });

  it("answers a registered email the same way and mails nothing", async () => {
    await registerElsewhere(signup.email);

    const res = await ask();

    expect(res.status).toBe(202);
    expect(sent).toEqual([]);
    expect(await prisma.trialSignup.count()).toBe(0);
  });

  it("keeps hashes only, never the token or the password", async () => {
    const token = await linkFor();

    const stored = await prisma.trialSignup.findFirstOrThrow();
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.passwordHash).not.toContain(signup.password);
  });

  it.each([
    ["an empty organization name", { organizationName: " " }],
    ["a malformed email", { email: "not-an-email" }],
    ["a short password", { password: "short" }],
  ])("refuses %s -> 400", async (_label, body) => {
    expect((await ask(body)).status).toBe(400);
    expect(await prisma.trialSignup.count()).toBe(0);
  });

  it("limits the rate of requests -> 429", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) await ask({ email: `a${attempt}@acme.com` });
    expect((await ask({ email: "late@acme.com" })).status).toBe(429);
  });
});

describe("a confirmation link", () => {
  it("passes the check while it works", async () => {
    const token = await linkFor();
    expect((await request(app).get(`${SIGNUPS}/${token}`)).status).toBe(204);
  });

  it("is refused once a newer link was asked for the same email", async () => {
    const first = await linkFor();
    const second = await linkFor();

    expect((await confirm(first)).status).toBe(404);
    expect((await confirm(second)).status).toBe(200);
  });

  it("is refused after a day", async () => {
    const token = await linkFor();
    await prisma.trialSignup.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    expect((await request(app).get(`${SIGNUPS}/${token}`)).status).toBe(404);
    expect((await confirm(token)).status).toBe(404);
  });

  it("is refused when unknown", async () => {
    expect((await confirm("0".repeat(64))).status).toBe(404);
  });
});

describe("confirming", () => {
  it("creates a trial organization with the visitor as its only admin and signs them in", async () => {
    const token = await linkFor();

    const res = await confirm(token);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    const organization = await prisma.organization.findFirstOrThrow({ where: { name: "Acme Ads" } });
    expect(organization.tariff).toBe("TRIAL");
    expect(organization.slug).toBe("acme-ads");
    expect(organization.trialEndsAt!.getTime())
      .toBeGreaterThan(trialEndsAtFrom(new Date(Date.now() - 60_000)).getTime());
    const members = await prisma.membership.findMany({ where: { orgId: organization.id }, include: { user: true } });
    expect(members.map((member) => [member.role, member.status, member.user.email]))
      .toEqual([["ADMIN", "ACTIVE", signup.email]]);
    expect(await prisma.trialSignup.count()).toBe(0);
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${res.body.accessToken}`);
    expect(me.status).toBe(200);
  });

  it("signs in with the chosen password afterwards", async () => {
    await confirm(await linkFor());
    const res = await request(app).post("/api/auth/login").send({ login: signup.email, password: signup.password });
    expect(res.status).toBe(200);
  });

  it("gives a second organization of the same name a distinct slug", async () => {
    await confirm(await linkFor());
    await confirm(await linkFor({ email: "other@acme.com" }));

    const slugs = (await prisma.organization.findMany({ where: { name: "Acme Ads" } }))
      .map(({ slug }) => slug).sort();
    expect(slugs).toEqual(["acme-ads", "acme-ads-2"]);
  });

  it("refuses a link once the email has been registered meanwhile", async () => {
    const token = await linkFor();
    await registerElsewhere(signup.email);
    const orgs = await prisma.organization.count();

    expect((await confirm(token)).status).toBe(404);
    expect(await prisma.organization.count()).toBe(orgs);
  });

  it("spends the link", async () => {
    const token = await linkFor();
    await confirm(token);
    expect((await confirm(token)).status).toBe(404);
  });

  it("creates exactly one organization when two requests race", async () => {
    const token = await linkFor();

    const results = await Promise.all([confirm(token), confirm(token)]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 404]);
    expect(await prisma.organization.count({ where: { name: "Acme Ads" } })).toBe(1);
  });

  it("stores nothing when the membership cannot be created", async () => {
    const token = await linkFor();
    const create = vi.spyOn(PrismaMembershipEnrolment.prototype, "enrol").mockRejectedValueOnce(new Error("down"));
    const orgs = await prisma.organization.count();

    expect((await confirm(token)).status).toBe(500);

    create.mockRestore();
    expect(await prisma.organization.count()).toBe(orgs);
    expect(await prisma.user.count({ where: { email: signup.email } })).toBe(0);
    expect((await confirm(token)).status).toBe(200);
  });
});
