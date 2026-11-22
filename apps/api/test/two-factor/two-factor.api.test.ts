import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { LogMailTransport, type MailMessage } from "../../src/shared/infrastructure/mail.js";
import { hashPassword } from "../../src/modules/identity/infrastructure/password-adapter.js";
import { resetIdentityRateLimits } from "../../src/modules/identity/presentation/http/identity-http.js";
import { resetTwoFactorRateLimits } from "../../src/modules/two-factor/index.js";
import { base32Decode, hotp, stepAt } from "../../src/modules/two-factor/infrastructure/totp-adapter.js";
import { PrismaTwoFactorStore } from "../../src/modules/two-factor/infrastructure/prisma-two-factor-store.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs, signInAsOutsider, signInAsPlatformAdmin } from "../helpers/auth.js";

const app = createApp();
const PASSWORD = "right-password";
const HOME = "198.51.100.1";
const AWAY = "203.0.113.5";
let sent: MailMessage[] = [];

beforeEach(async () => {
  await resetDb();
  await prisma.signInLock.deleteMany();
  resetIdentityRateLimits();
  resetTwoFactorRateLimits();
  sent = [];
  vi.spyOn(LogMailTransport.prototype, "send").mockImplementation(async (message) => { sent.push(message); });
});
afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => { await prisma.signInLock.deleteMany(); await prisma.$disconnect(); });

interface Account {
  id: string;
  email: string;
  membershipId: string;
  auth: { Authorization: string };
  key: string | null;
  backupCodes: string[];
}

const codeFor = (key: string, offset = 0) => hotp(base32Decode(key), stepAt(new Date()) + offset);

const signIn = (email: string, from = HOME, password = PASSWORD) =>
  request(app).post("/api/auth/login").set("X-Forwarded-For", from).send({ login: email, password });

const finish = (challenge: string, code: string, from = AWAY) =>
  request(app).post("/api/auth/two-factor").set("X-Forwarded-For", from).send({ challenge, code });

async function member(name: string, role: "ADMIN" | "MANAGER" | "GUEST" | "CLIENT" = "ADMIN"): Promise<Account> {
  const signed = await signInAs(name, { role });
  const email = `${name.toLowerCase()}@acme.com`;
  await prisma.user.update({ where: { id: signed.user.id }, data: { email, passwordHash: await hashPassword(PASSWORD) } });
  return { id: signed.user.id, email, membershipId: signed.membership!.id, auth: signed.auth, key: null, backupCodes: [] };
}

async function enrol(account: Account): Promise<Account> {
  const setup = await request(app).post("/api/two-factor/setup").set(account.auth);
  expect(setup.status).toBe(200);
  const confirmed = await request(app).post("/api/two-factor/confirm").set(account.auth).set("X-Forwarded-For", HOME)
    .send({ code: codeFor(setup.body.key) });
  expect(confirmed.status).toBe(200);
  return { ...account, key: setup.body.key, backupCodes: confirmed.body.backupCodes };
}

async function challengeFor(account: Account, from = AWAY): Promise<string> {
  const res = await signIn(account.email, from);
  expect(res.status).toBe(200);
  expect(res.body.twoFactor?.challenge).toEqual(expect.any(String));
  return res.body.twoFactor.challenge;
}

describe("turning two-factor sign-in on", () => {
  it("shows a QR code and a key, then backup codes once, and keeps the secret to itself", async () => {
    const account = await member("Olga");

    const setup = await request(app).post("/api/two-factor/setup").set(account.auth);
    expect(setup.body).toMatchObject({ key: expect.stringMatching(/^[A-Z2-7]{32}$/), uri: expect.stringMatching(/^otpauth:\/\/totp\//) });
    expect(setup.body.qrSvg).toMatch(/^<svg/);

    const confirmed = await request(app).post("/api/two-factor/confirm").set(account.auth).send({ code: codeFor(setup.body.key) });
    expect(confirmed.body.backupCodes).toHaveLength(10);

    const status = await request(app).get("/api/two-factor").set(account.auth);
    expect(status.body).toEqual({ enabled: true, required: false, backupCodesLeft: 10 });
    const stored = await prisma.twoFactor.findUniqueOrThrow({ where: { userId: account.id } });
    expect(stored.sealedSecret).not.toContain(setup.body.key);
    const me = await request(app).get("/api/auth/me").set(account.auth);
    expect(JSON.stringify(me.body)).not.toContain(setup.body.key);
  });

  it("stays off after a wrong code", async () => {
    const account = await member("Olga");
    await request(app).post("/api/two-factor/setup").set(account.auth);

    expect((await request(app).post("/api/two-factor/confirm").set(account.auth).send({ code: "000000" })).status).toBe(400);
    expect((await request(app).get("/api/two-factor").set(account.auth)).body.enabled).toBe(false);
  });
});

describe("signing in", () => {
  it("asks for a code on a new address, sets no session, then trusts the address", async () => {
    const account = await enrol(await member("Olga"));

    const first = await signIn(account.email, AWAY);
    expect(first.body.twoFactor).toEqual({ challenge: expect.any(String), expiresAt: expect.any(String) });
    expect(first.body.accessToken).toBeUndefined();
    expect(first.headers["set-cookie"]).toBeUndefined();

    const done = await finish(first.body.twoFactor.challenge, codeFor(account.key!, 1));
    expect(done.status).toBe(200);
    expect(done.body.accessToken).toEqual(expect.any(String));
    expect(String(done.headers["set-cookie"])).toContain("adpulse_access=");

    expect((await signIn(account.email, AWAY)).body.accessToken).toEqual(expect.any(String));
  });

  it("signs in with the password alone on the address that confirmed the setup", async () => {
    const account = await enrol(await member("Olga"));

    expect((await signIn(account.email, HOME)).body.accessToken).toEqual(expect.any(String));
  });

  it("asks nobody without two-factor sign-in for a code", async () => {
    const account = await member("Olga");

    expect((await signIn(account.email, AWAY)).body.accessToken).toEqual(expect.any(String));
  });

  it("spends a backup code", async () => {
    const account = await enrol(await member("Olga"));

    expect((await finish(await challengeFor(account), account.backupCodes[0]!.toUpperCase())).status).toBe(200);
    await prisma.trustedAddress.deleteMany();
    const again = await finish(await challengeFor(account), account.backupCodes[0]!);
    expect(again.status).toBe(401);
    expect(again.body.error.details[0].code).toBe("INVALID_CODE");
  });

  it("refuses a code that already signed in", async () => {
    const account = await enrol(await member("Olga"));
    const code = codeFor(account.key!, 1);

    expect((await finish(await challengeFor(account), code)).status).toBe(200);
    expect((await finish(await challengeFor(account, "203.0.113.6"), code, "203.0.113.6")).status).toBe(401);
  });

  it("spends a time step once in the database, whatever the caller checked", async () => {
    const account = await enrol(await member("Olga"));
    const store = new PrismaTwoFactorStore(prisma);
    const step = stepAt(new Date()) + 5;

    expect(await store.spendStep(account.id, step)).toBe(true);
    expect(await store.spendStep(account.id, step)).toBe(false);
    expect(await store.spendStep(account.id, step - 1)).toBe(false);
  });

  it("lets one code sign in only once when two requests race", async () => {
    const account = await enrol(await member("Olga"));
    const code = codeFor(account.key!, 1);
    const first = await challengeFor(account);
    const second = await challengeFor(account, "203.0.113.6");

    const answers = await Promise.all([finish(first, code), finish(second, code, "203.0.113.6")]);

    expect(answers.map((res) => res.status).sort()).toEqual([200, 401]);
  });

  it("locks sign-in after three wrong codes", async () => {
    const account = await enrol(await member("Olga"));
    const challenge = await challengeFor(account);

    const answers = [];
    for (let index = 0; index < 3; index++) answers.push(await finish(challenge, "000000"));

    expect(answers.map((res) => res.status)).toEqual([401, 401, 403]);
    expect(answers[2]!.body.error.details[0].code).toBe("SIGN_IN_LOCKED");
    expect((await finish(challenge, codeFor(account.key!, 1))).status).toBe(403);
  });

  it("does not let a right password reset the count of wrong codes", async () => {
    const account = await enrol(await member("Olga"));

    await finish(await challengeFor(account), "000000");
    await finish(await challengeFor(account), "000000");
    const third = await finish(await challengeFor(account), "000000");

    expect(third.status).toBe(403);
  });

  it("forgives earlier password typos once the code is right", async () => {
    const account = await enrol(await member("Olga"));
    await signIn(account.email, AWAY, "wrong-password");
    await signIn(account.email, AWAY, "wrong-password");

    expect((await finish(await challengeFor(account), codeFor(account.key!, 1))).status).toBe(200);
    expect(await prisma.signInLock.count()).toBe(0);
  });

  it("refuses an expired challenge", async () => {
    const account = await enrol(await member("Olga"));
    const challenge = await challengeFor(account);
    await prisma.twoFactorChallenge.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await finish(challenge, codeFor(account.key!, 1));
    expect(res.status).toBe(401);
    expect(res.body.error.details[0].code).toBe("TWO_FACTOR_CHALLENGE_EXPIRED");
  });
});

describe("a reset link", () => {
  it("asks for the code before signing in from a new address", async () => {
    const account = await enrol(await member("Olga"));
    await request(app).post("/api/auth/password-reset").send({ email: account.email });
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const token = /\/password-reset\/([0-9a-f]+)/.exec(sent[0]!.text)![1];

    const res = await request(app).post(`/api/auth/password-reset/${token}`).set("X-Forwarded-For", AWAY).send({ password: "brand-new-pass" });

    expect(res.body.twoFactor?.challenge).toEqual(expect.any(String));
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect((await finish(res.body.twoFactor.challenge, codeFor(account.key!, 1))).status).toBe(200);
  });
});

describe("trusted addresses", () => {
  it("are listed and forgotten", async () => {
    const account = await enrol(await member("Olga"));

    const listed = await request(app).get("/api/two-factor/addresses").set(account.auth);
    expect(listed.body.map((entry: { address: string }) => entry.address)).toEqual([HOME]);

    await request(app).delete(`/api/two-factor/addresses/${listed.body[0].id}`).set(account.auth).expect(204);
    expect((await signIn(account.email, HOME)).body.twoFactor).toBeDefined();
  });
});

describe("turning it off and new backup codes", () => {
  it("need a current code", async () => {
    const account = await enrol(await member("Olga"));

    expect((await request(app).post("/api/two-factor/backup-codes").set(account.auth).send({ code: "000000" })).status).toBe(400);
    const renewed = await request(app).post("/api/two-factor/backup-codes").set(account.auth).send({ code: codeFor(account.key!, 1) });
    expect(renewed.body.backupCodes).toHaveLength(10);
    expect(renewed.body.backupCodes).not.toContain(account.backupCodes[0]);

    expect((await request(app).post("/api/two-factor/disable").set(account.auth).send({ code: "000000" })).status).toBe(400);
    expect((await request(app).post("/api/two-factor/disable").set(account.auth).send({ code: renewed.body.backupCodes[0] })).status).toBe(204);
    expect((await signIn(account.email, AWAY)).body.accessToken).toEqual(expect.any(String));
  });

  it("is refused to an employee whose organization requires it", async () => {
    const admin = await member("Admin");
    const manager = await enrol(await member("Manager", "MANAGER"));
    await request(app).put("/api/organization/two-factor").set(admin.auth).send({ required: true });

    expect((await request(app).post("/api/two-factor/disable").set(manager.auth).send({ code: manager.backupCodes[0] })).status).toBe(403);
  });
});

describe("the organization requirement", () => {
  it("leaves an employee without it only the setup", async () => {
    const admin = await enrol(await member("Admin"));
    const manager = await member("Manager", "MANAGER");

    expect((await request(app).put("/api/organization/two-factor").set(admin.auth).send({ required: true })).body).toEqual({ required: true });

    const blocked = await request(app).get("/api/projects").set(manager.auth);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.details[0].code).toBe("TWO_FACTOR_SETUP_REQUIRED");
    expect((await request(app).get("/api/two-factor").set(manager.auth)).body).toMatchObject({ enabled: false, required: true });
    expect((await request(app).get("/api/auth/me").set(manager.auth)).status).toBe(200);

    await enrol(manager);
    expect((await request(app).get("/api/projects").set(manager.auth)).status).toBe(200);
  });

  it("does not touch a client", async () => {
    const admin = await enrol(await member("Admin"));
    const client = await member("Client", "CLIENT");
    await request(app).put("/api/organization/two-factor").set(admin.auth).send({ required: true });

    expect((await request(app).get("/api/projects").set(client.auth)).status).toBe(200);
  });

  it("is changed by an admin only", async () => {
    const manager = await member("Manager", "MANAGER");

    expect((await request(app).put("/api/organization/two-factor").set(manager.auth).send({ required: true })).status).toBe(403);
  });
});

describe("resets", () => {
  it("let an admin reset another member, ending their sessions", async () => {
    const admin = await member("Admin");
    const manager = await enrol(await member("Manager", "MANAGER"));
    await signIn(manager.email, HOME);
    expect(await prisma.refreshToken.count({ where: { userId: manager.id } })).toBeGreaterThan(0);

    expect((await request(app).post(`/api/organization/two-factor/members/${manager.membershipId}/reset`).set(admin.auth)).status).toBe(204);

    expect(await prisma.refreshToken.count({ where: { userId: manager.id } })).toBe(0);
    expect((await signIn(manager.email, AWAY)).body.accessToken).toEqual(expect.any(String));
    const event = await prisma.auditEvent.findFirst({ where: { entityId: manager.membershipId } });
    expect(event?.summary).toContain("Reset the second factor");
  });

  it("refuse an admin's own reset and another organization's member", async () => {
    const admin = await member("Admin");
    const outsider = await signInAsOutsider("Far");

    expect((await request(app).post(`/api/organization/two-factor/members/${admin.membershipId}/reset`).set(admin.auth)).status).toBe(403);
    expect((await request(app).post(`/api/organization/two-factor/members/${outsider.membership.id}/reset`).set(admin.auth)).status).toBe(404);
  });

  it("let the platform administrator reset anyone by email, and nobody else", async () => {
    const owner = await enrol(await member("Owner"));
    const platform = await signInAsPlatformAdmin();

    expect((await request(app).post("/api/platform/two-factor/reset").set(owner.auth).send({ email: owner.email })).status).toBe(403);
    expect((await request(app).post("/api/platform/two-factor/reset").set(platform.auth).send({ email: owner.email })).status).toBe(204);
    expect((await signIn(owner.email, AWAY)).body.accessToken).toEqual(expect.any(String));
  });

  it("let the platform administrator turn two-factor sign-in on for themself", async () => {
    const platform = await signInAsPlatformAdmin();

    expect((await request(app).post("/api/two-factor/setup").set(platform.auth)).status).toBe(200);
  });
});

describe("organization data", () => {
  it("lists who is enrolled for an admin", async () => {
    const admin = await member("Admin");
    const manager = await enrol(await member("Manager", "MANAGER"));
    void (await seedProject(admin.id));

    const res = await request(app).get("/api/organization/two-factor").set(admin.auth);
    expect(res.body).toEqual({ required: false, enrolledMembershipIds: [manager.membershipId] });
    expect((await currentOrg()).id).toEqual(expect.any(String));
  });
});
