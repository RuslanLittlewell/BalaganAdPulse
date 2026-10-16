import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { LogMailTransport, type MailMessage } from "../../src/shared/infrastructure/mail.js";
import { resetIdentityRateLimits } from "../../src/modules/identity/presentation/http/identity-http.js";
import { resetDb } from "../helpers/db.js";
import { createInvite } from "../helpers/auth.js";

const app = createApp();
const account = { name: "Buyer", email: "buyer@acme.com", password: "hunter2hunter2", inviteCode: "invite-first" };
let sent: MailMessage[] = [];

beforeEach(async () => {
  await resetDb();
  resetIdentityRateLimits();
  await createInvite("invite-first");
  sent = [];
  vi.spyOn(LogMailTransport.prototype, "send").mockImplementation(async (message) => { sent.push(message); });
});
afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => { await prisma.$disconnect(); });

const register = () => request(app).post("/api/auth/register").send(account);
const askForLink = (email = account.email) => request(app).post("/api/auth/password-reset").send({ email });
const tokenOf = (message: MailMessage) => /\/password-reset\/([0-9a-f]+)/.exec(message.text)![1];
const signIn = (password: string) => request(app).post("/api/auth/login").send({ email: account.email, password });

describe("POST /api/auth/password-reset", () => {
  it("accepts a registered email and mails it a link to the app", async () => {
    await register();

    const res = await askForLink();

    expect(res.status).toBe(202);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].to).toBe(account.email);
    expect(sent[0].text).toMatch(/^http:\/\/localhost:5173\/password-reset\/[0-9a-f]{64}$/m);
  });

  it("answers an unknown email the same way and mails nothing", async () => {
    const res = await askForLink("nobody@acme.com");

    expect(res.status).toBe(202);
    expect(sent).toEqual([]);
    expect(await prisma.passwordReset.count()).toBe(0);
  });

  it("keeps only a hash of the token", async () => {
    await register();
    await askForLink();
    await vi.waitFor(() => expect(sent).toHaveLength(1));

    const stored = await prisma.passwordReset.findFirstOrThrow();
    expect(stored.tokenHash).not.toBe(tokenOf(sent[0]));
  });

  it("refuses something that is not an email", async () => {
    expect((await askForLink("not-an-email")).status).toBe(400);
  });
});

describe("a reset link", () => {
  beforeEach(async () => { await register(); });

  const linkFor = async () => {
    await askForLink();
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    return tokenOf(sent[0]);
  };

  it("works, sets the new password, ends the old sessions and signs in", async () => {
    const before = (await signIn(account.password)).body.refreshToken as string;
    const token = await linkFor();

    expect((await request(app).get(`/api/auth/password-reset/${token}`)).status).toBe(204);
    const res = await request(app).post(`/api/auth/password-reset/${token}`).send({ password: "brand-new-pass" });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((cookie) => cookie.startsWith("adpulse_refresh="))).toBe(true);
    expect((await signIn(account.password)).status).toBe(401);
    expect((await signIn("brand-new-pass")).status).toBe(200);
    expect((await request(app).post("/api/auth/refresh").send({ refreshToken: before })).status).toBe(401);
  });

  it("works only once", async () => {
    const token = await linkFor();
    await request(app).post(`/api/auth/password-reset/${token}`).send({ password: "brand-new-pass" });

    expect((await request(app).get(`/api/auth/password-reset/${token}`)).status).toBe(404);
    const again = await request(app).post(`/api/auth/password-reset/${token}`).send({ password: "another-pass" });
    expect(again.status).toBe(404);
    expect(again.body.error.message).toBe("This password reset link is invalid or has expired");
  });

  it("stops working after an hour", async () => {
    const token = await linkFor();
    await prisma.passwordReset.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    expect((await request(app).get(`/api/auth/password-reset/${token}`)).status).toBe(404);
    expect((await request(app).post(`/api/auth/password-reset/${token}`).send({ password: "brand-new-pass" })).status).toBe(404);
  });

  it("is replaced by a newer one", async () => {
    const first = await linkFor();
    await askForLink();
    await vi.waitFor(() => expect(sent).toHaveLength(2));

    expect((await request(app).get(`/api/auth/password-reset/${first}`)).status).toBe(404);
    expect((await request(app).get(`/api/auth/password-reset/${tokenOf(sent[1])}`)).status).toBe(204);
  });

  it("refuses a password shorter than 8 characters and keeps the link", async () => {
    const token = await linkFor();

    expect((await request(app).post(`/api/auth/password-reset/${token}`).send({ password: "short" })).status).toBe(400);
    expect((await request(app).get(`/api/auth/password-reset/${token}`)).status).toBe(204);
  });

  it("answers a made-up token as invalid", async () => {
    expect((await request(app).get(`/api/auth/password-reset/${"0".repeat(64)}`)).status).toBe(404);
  });
});
