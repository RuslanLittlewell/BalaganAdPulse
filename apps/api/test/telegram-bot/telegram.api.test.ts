import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { createContainer } from "../../src/composition/create-container.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { SystemClock } from "../../src/shared/infrastructure/clock.js";
import { createTelegramLinkUseCases, createTelegramRouter } from "../../src/modules/telegram-bot/index.js";
import {
  PrismaTelegramLinks,
  PrismaTelegramMembers,
  RandomLinkTokens,
} from "../../src/modules/telegram-bot/infrastructure/prisma-telegram.js";
import { currentOrg, signInAs, type SignedIn } from "../helpers/auth.js";
import { resetDb } from "../helpers/db.js";

const links = new PrismaTelegramLinks(prisma);
const tokens = new RandomLinkTokens();

const configured = createApp({
  container: {
    ...createContainer(),
    telegramRouter: createTelegramRouter(createTelegramLinkUseCases({
      links,
      members: new PrismaTelegramMembers(prisma),
      tokens,
      identity: { username: async () => "adpulse_bot" },
      clock: new SystemClock(),
    })),
  },
});
const bare = createApp();

let anna: SignedIn;

beforeEach(async () => {
  await resetDb();
  anna = await signInAs("Анна");
});

afterAll(() => prisma.$disconnect());

const tokenOf = (url: string) => new URL(url).searchParams.get("start")!;

describe("the Telegram bot in the API", () => {
  it("is not offered when the server has no bot token or Groq key", async () => {
    const status = await request(bare).get("/api/telegram").set(anna.auth);

    expect(status.status).toBe(200);
    expect(status.body).toEqual({ available: false, linked: false, username: null, linkedAt: null });
    expect((await request(bare).post("/api/telegram/link").set(anna.auth)).status).toBe(404);
    expect((await request(bare).delete("/api/telegram/link").set(anna.auth)).status).toBe(204);
  });

  it("issues a one-time link that links the member's chat", async () => {
    const before = Date.now();
    const issued = await request(configured).post("/api/telegram/link").set(anna.auth);

    expect(issued.status).toBe(201);
    expect(issued.body.url).toMatch(/^https:\/\/t\.me\/adpulse_bot\?start=[A-Za-z0-9_-]{32}$/);
    const expiresIn = Date.parse(issued.body.expiresAt) - before;
    expect(expiresIn).toBeGreaterThan(14 * 60_000);
    expect(expiresIn).toBeLessThanOrEqual(15 * 60_000 + 1_000);
    const stored = await prisma.telegramLinkToken.findUniqueOrThrow({ where: { membershipId: anna.membership!.id } });
    expect(stored.tokenHash).toBe(tokens.hash(tokenOf(issued.body.url)));

    await links.redeem(stored.tokenHash, new Date(), { id: 555, username: "anna_t" });
    const status = await request(configured).get("/api/telegram").set(anna.auth);

    expect(status.body).toEqual({ available: true, linked: true, username: "anna_t", linkedAt: expect.any(String) });
  });

  it("unlinks the member", async () => {
    await links.issueToken(anna.membership!.id, "hash", new Date(Date.now() + 60_000));
    await links.redeem("hash", new Date(), { id: 555, username: null });

    expect((await request(configured).delete("/api/telegram/link").set(anna.auth)).status).toBe(204);
    expect((await request(configured).get("/api/telegram").set(anna.auth)).body.linked).toBe(false);
  });

  it("is offered to admins and managers only, and not when the Tasks module is off", async () => {
    const manager = await signInAs("Борис", { role: "MANAGER" });
    const guest = await signInAs("Глеб", { role: "GUEST" });
    const client = await signInAs("Клиент", { role: "CLIENT" });

    expect((await request(configured).get("/api/telegram").set(manager.auth)).body.available).toBe(true);
    for (const member of [guest, client]) {
      expect((await request(configured).get("/api/telegram").set(member.auth)).body.available).toBe(false);
      expect((await request(configured).post("/api/telegram/link").set(member.auth)).status).toBe(404);
    }

    await prisma.organization.update({ where: { id: (await currentOrg()).id }, data: { modules: ["CRM", "REPORTS"] } });
    expect((await request(configured).get("/api/telegram").set(anna.auth)).body.available).toBe(false);
  });

  it("needs a session", async () => {
    expect((await request(configured).get("/api/telegram")).status).toBe(401);
  });
});
