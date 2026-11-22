import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { LogMailTransport, type MailMessage } from "../../src/shared/infrastructure/mail.js";
import { hashPassword } from "../../src/modules/identity/infrastructure/password-adapter.js";
import { PrismaClientAccountRepository } from "../../src/modules/client-accounts/infrastructure/prisma-client-account-repository.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { resetIdentityRateLimits } from "../../src/modules/identity/presentation/http/identity-http.js";
import { resetDb } from "../helpers/db.js";

const app = createApp();
const EMAIL = "olga@acme.com";
const PASSWORD = "right-password";
const ISSUED_HASH = "scrypt-placeholder";
let userId: string;
let sent: MailMessage[] = [];

beforeEach(async () => {
  await resetDb();
  await prisma.signInLock.deleteMany();
  resetIdentityRateLimits();
  sent = [];
  vi.spyOn(LogMailTransport.prototype, "send").mockImplementation(async (message) => { sent.push(message); });
  userId = (await prisma.user.create({ data: { name: "Olga", email: EMAIL, login: "olga", passwordHash: await hashPassword(PASSWORD) } })).id;
});
afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => { await prisma.signInLock.deleteMany(); await prisma.$disconnect(); });

const signIn = (password: string, login = EMAIL) => request(app).post("/api/auth/login").send({ login, password });
const fail = async (times: number, login = EMAIL) => {
  const answers = [];
  for (let index = 0; index < times; index++) answers.push(await signIn("wrong-password", login));
  return answers;
};
const expire = () => prisma.signInLock.updateMany({ data: { lockedUntil: new Date(Date.now() - 1000) } });
const codeOf = (res: request.Response) => res.body.error?.details?.[0]?.code;

describe("failed sign-in attempts", () => {
  it("lock sign-in for 15 minutes after three failures, even for the right password", async () => {
    const answers = await fail(3);

    expect(answers.map((res) => res.status)).toEqual([401, 401, 403]);
    expect(codeOf(answers[2])).toBe("SIGN_IN_LOCKED");
    const until = new Date(answers[2].body.error.details[0].until).getTime();
    expect(until - Date.now()).toBeGreaterThan(14 * 60_000);
    expect(until - Date.now()).toBeLessThanOrEqual(15 * 60_000);
    const right = await signIn(PASSWORD);
    expect(right.status).toBe(403);
    expect(codeOf(right)).toBe("SIGN_IN_LOCKED");
  });

  it("let the right password in once the lock ends, and forget the failures", async () => {
    await fail(3);
    await expire();

    expect((await signIn(PASSWORD)).status).toBe(200);
    expect(await prisma.signInLock.count()).toBe(0);
  });

  it("require a password reset after three more failures, however long one waits", async () => {
    await fail(3);
    await expire();

    const answers = await fail(3);
    expect(answers.map((res) => res.status)).toEqual([401, 401, 403]);
    expect(codeOf(answers[2])).toBe("PASSWORD_RESET_REQUIRED");

    await expire();
    const right = await signIn(PASSWORD);
    expect(right.status).toBe(403);
    expect(codeOf(right)).toBe("PASSWORD_RESET_REQUIRED");
  });

  it("are lifted by setting a new password through a reset link", async () => {
    await fail(3);
    await expire();
    await fail(3);

    await request(app).post("/api/auth/password-reset").send({ email: EMAIL });
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const token = /\/password-reset\/([0-9a-f]+)/.exec(sent[0].text)![1];
    expect((await request(app).post(`/api/auth/password-reset/${token}`).send({ password: "brand-new-pass" })).status).toBe(200);

    expect((await signIn("brand-new-pass")).status).toBe(200);
  });

  it("are lifted when the agency issues a new password", async () => {
    await fail(3);
    await expire();
    await fail(3);

    const unitOfWork = new PrismaUnitOfWork(prisma);
    const accounts = new PrismaClientAccountRepository(prisma, unitOfWork);
    await unitOfWork.run((context) => accounts.setPassword(context, userId, { passwordHash: ISSUED_HASH, issuedPassword: "sealed" }));

    expect(await prisma.signInLock.count()).toBe(0);
  });

  it("share one count between the account's login and email", async () => {
    await fail(2, EMAIL);
    const third = (await fail(1, "olga"))[0];

    expect(third.status).toBe(403);
    expect(codeOf(third)).toBe("SIGN_IN_LOCKED");
  });

  it("answer an unknown login exactly like a known one", async () => {
    const known = await fail(3);
    resetIdentityRateLimits();
    const unknown = await fail(3, "nobody@acme.com");

    expect(unknown.map((res) => res.status)).toEqual(known.map((res) => res.status));
    expect(unknown.map(codeOf)).toEqual(known.map(codeOf));
    expect(unknown.map((res) => res.body.error.message)).toEqual(known.map((res) => res.body.error.message));
  });

  it("let no more than three guesses through when they arrive at once", async () => {
    const answers = await Promise.all(Array.from({ length: 6 }, () => signIn("wrong-password")));

    expect(answers.filter((res) => res.status === 401).length).toBeLessThanOrEqual(2);
    expect(answers.filter((res) => res.status === 403).length).toBeGreaterThanOrEqual(4);
    expect((await signIn(PASSWORD)).status).toBe(403);
  });
});

