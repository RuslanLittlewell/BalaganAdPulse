import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { createContainer } from "../../src/composition/create-container.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { SystemClock } from "../../src/shared/infrastructure/clock.js";
import type { MailMessage, MailTransport } from "../../src/shared/infrastructure/mail.js";
import { createSupportRouter, createSupportUseCases, FEEDBACK_UNAVAILABLE } from "../../src/modules/support/index.js";
import { PrismaFeedbackSenders } from "../../src/modules/support/infrastructure/prisma-feedback-senders.js";
import { SupportMailer } from "../../src/modules/support/infrastructure/support-mailer.js";
import { resetDb } from "../helpers/db.js";
import { currentOrg, signInAs, signInAsPlatformAdmin } from "../helpers/auth.js";

const SUPPORT = "balagan.ads@gmail.com";
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const PDF = Buffer.from("%PDF-1.7\n");

const sent: MailMessage[] = [];
let failing = false;
const transport: MailTransport = {
  send: async (message) => {
    if (failing) throw new Error("SMTP refused");
    sent.push(message);
  },
};

const supportRouter = createSupportRouter(createSupportUseCases({
  senders: new PrismaFeedbackSenders(prisma),
  mailbox: new SupportMailer(transport, SUPPORT),
  clock: new SystemClock(),
}));
const app = createApp({ container: { ...createContainer(), supportRouter } });
const unconfigured = createApp({
  container: {
    ...createContainer(),
    supportRouter: createSupportRouter(createSupportUseCases({
      senders: new PrismaFeedbackSenders(prisma),
      mailbox: new SupportMailer(transport, null),
      clock: new SystemClock(),
    })),
  },
});

beforeEach(async () => {
  await resetDb();
  sent.length = 0;
  failing = false;
  supportRouter.feedbackLimit.reset();
});
afterAll(async () => { await prisma.$disconnect(); });

const feedback = (auth: { Authorization: string }, fields: Record<string, string> = {}, target = app) => {
  const call = request(target).post("/api/support/feedback").set(auth);
  for (const [name, value] of Object.entries({ topic: "PROBLEM", message: "Отчёт не открывается", ...fields })) {
    call.field(name, value);
  }
  return call;
};

describe("sending feedback", () => {
  it("mails support one message with the screenshots, the context and the sender as reply-to", async () => {
    const { auth } = await signInAs("Анна", { role: "MANAGER" });
    await prisma.user.updateMany({ where: { name: "Анна" }, data: { email: "anna@acme.com" } });
    const org = await currentOrg();
    await prisma.organization.update({ where: { id: org.id }, data: { tariff: "AGENCY" } });

    const res = await feedback(auth, {
      page: "/projects/42", userAgent: "Mozilla/5.0 Test", screen: "1920x1080",
    })
      .attach("screenshots", PNG, "first.png")
      .attach("screenshots", JPEG, "second.jpg");

    expect(res.status).toBe(202);
    expect(sent).toHaveLength(1);
    const [mail] = sent;
    expect(mail).toMatchObject({
      to: SUPPORT,
      replyTo: "anna@acme.com",
      subject: `[Balagan BI] Сообщить о проблеме · ${org.name}`,
    });
    expect(mail!.text).toContain("Отчёт не открывается");
    for (const line of [
      `Организация: ${org.name}`, "Отправитель: Анна <anna@acme.com>", "Роль: MANAGER", "Тариф: AGENCY",
      "Страница: /projects/42", "Браузер: Mozilla/5.0 Test", "Экран: 1920x1080", "Скриншотов: 2",
    ]) expect(mail!.text).toContain(line);
    expect(mail!.attachments?.map(({ filename, contentType }) => ({ filename, contentType }))).toEqual([
      { filename: "screenshot-1.png", contentType: "image/png" },
      { filename: "screenshot-2.jpg", contentType: "image/jpeg" },
    ]);
  });

  it("names the sender's own organization whatever the body claims", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    const org = await currentOrg();

    const res = await feedback(auth, { organization: "Globex", role: "ADMIN" });

    expect(res.status).toBe(202);
    expect(sent[0]!.text).toContain(`Организация: ${org.name}`);
    expect(sent[0]!.text).not.toContain("Globex");
  });

  it("names the login and sets no reply-to for a sender without an email", async () => {
    const { auth, user } = await signInAs("Клиника", { role: "CLIENT" });
    await prisma.user.update({ where: { id: user.id }, data: { email: null, login: "klinika-4821@balagan.pro" } });

    const res = await feedback(auth, { topic: "QUESTION" });

    expect(res.status).toBe(202);
    expect(sent[0]!.replyTo).toBeUndefined();
    expect(sent[0]!.text).toContain("Отправитель: Клиника, логин klinika-4821@balagan.pro");
    expect(sent[0]!.subject).toContain("Вопрос по работе сервиса");
  });

  it("escapes the message in the HTML part", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });

    await feedback(auth, { message: "<script>alert(1)</script>" });

    expect(sent[0]!.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(sent[0]!.html).not.toContain("<script>");
  });

  it("is open on an expired trial", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    await prisma.organization.update({
      where: { id: (await currentOrg()).id },
      data: { tariff: "TRIAL", trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    expect((await feedback(auth, { topic: "TARIFF" })).status).toBe(202);
    expect((await request(app).post("/api/clients").set(auth).send({ name: "Acme" })).status).toBe(403);
  });

  it.each([
    ["an unknown topic", { topic: "BILLING" }],
    ["an empty message", { message: "   " }],
    ["a message over 5000 characters", { message: "я".repeat(5001) }],
  ])("refuses %s -> 400 and sends nothing", async (_label, fields) => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });

    expect((await feedback(auth, fields)).status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it("refuses a file that is not a PNG, JPEG or WebP image", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });

    const res = await feedback(auth).attach("screenshots", PDF, "shot.png");

    expect(res.status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it("refuses a fourth screenshot", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });

    const res = await feedback(auth)
      .attach("screenshots", PNG, "1.png").attach("screenshots", PNG, "2.png")
      .attach("screenshots", PNG, "3.png").attach("screenshots", PNG, "4.png");

    expect(res.status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it("refuses a screenshot over 5 MB", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });

    const res = await feedback(auth).attach("screenshots", Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]), "big.png");

    expect(res.status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it("answers 503 when the mail server refuses the message", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    failing = true;

    const res = await feedback(auth);

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: { message: FEEDBACK_UNAVAILABLE } });
  });

  it("answers 503 when no support address is set", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });

    expect((await feedback(auth, {}, unconfigured)).status).toBe(503);
    expect(sent).toHaveLength(0);
  });

  it("lets one person send five messages in ten minutes and refuses the sixth", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    const other = await signInAs("Colleague", { role: "MANAGER" });

    for (let index = 0; index < 5; index += 1) expect((await feedback(auth)).status).toBe(202);
    const sixth = await feedback(auth);

    expect(sixth.status).toBe(429);
    expect(sent).toHaveLength(5);
    expect((await feedback(other.auth)).status).toBe(202);
  });
});

describe("who reaches support", () => {
  it("refuses a caller without a session -> 401", async () => {
    expect((await request(app).post("/api/support/feedback").field("topic", "PROBLEM").field("message", "x")).status).toBe(401);
    expect((await request(app).get("/api/support/contacts")).status).toBe(401);
  });

  it("refuses the platform administrator -> 403", async () => {
    const { auth } = await signInAsPlatformAdmin();
    expect((await feedback(auth)).status).toBe(403);
    expect((await request(app).get("/api/support/contacts").set(auth)).status).toBe(403);
  });

  it("refuses a member of a suspended organization -> 403", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    await prisma.organization.update({ where: { id: (await currentOrg()).id }, data: { status: "SUSPENDED" } });

    expect((await feedback(auth)).status).toBe(403);
    expect(sent).toHaveLength(0);
  });
});

describe("the support contacts", () => {
  it("name the address and that feedback can be sent", async () => {
    const { auth } = await signInAs("Client", { role: "CLIENT" });

    const res = await request(app).get("/api/support/contacts").set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ email: SUPPORT, feedback: true });
  });

  it("say that feedback cannot be sent when no address is set", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });

    expect((await request(unconfigured).get("/api/support/contacts").set(auth)).body)
      .toEqual({ email: null, feedback: false });
  });
});
