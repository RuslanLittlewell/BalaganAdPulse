import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import {
  PrismaTaskCatalogs,
  PrismaTaskDrafts,
  PrismaTelegramLinks,
  PrismaTelegramMembers,
  RandomLinkTokens,
} from "../../src/modules/telegram-bot/infrastructure/prisma-telegram.js";
import type { TaskDraft } from "../../src/modules/telegram-bot/index.js";
import { currentOrg, grantAccess, signInAs, signInAsOutsider, type SignedIn } from "../helpers/auth.js";
import { resetDb, seedProject } from "../helpers/db.js";

const links = new PrismaTelegramLinks(prisma);
const members = new PrismaTelegramMembers(prisma);
const catalogs = new PrismaTaskCatalogs(prisma);
const drafts = new PrismaTaskDrafts(prisma);

const NOW = new Date("2026-10-19T11:00:00Z");
const LATER = new Date("2026-10-19T11:20:00Z");
const BIG_CHAT = 7_000_000_000_123;

let anna: SignedIn;
let boris: SignedIn;

beforeEach(async () => {
  await resetDb();
  anna = await signInAs("Анна");
  boris = await signInAs("Борис", { role: "MANAGER" });
});

afterAll(() => prisma.$disconnect());

const idOf = (member: SignedIn) => member.membership!.id;

describe("link tokens", () => {
  it("are random, URL-safe and stored only as a hash", () => {
    const tokens = new RandomLinkTokens();
    const first = tokens.issue();
    const second = tokens.issue();

    expect(first.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(first.token).not.toBe(second.token);
    expect(first.hash).toBe(tokens.hash(first.token));
    expect(first.hash).not.toContain(first.token);
  });
});

describe("Telegram links", () => {
  it("links the chat once by a fresh token, keeping only the latest token per member", async () => {
    await links.issueToken(idOf(anna), "old", LATER);
    await links.issueToken(idOf(anna), "new", LATER);

    expect(await links.redeem("old", NOW, { id: BIG_CHAT, username: "anna_t" })).toBeNull();
    expect(await links.redeem("new", NOW, { id: BIG_CHAT, username: "anna_t" })).toBe(idOf(anna));
    expect(await links.redeem("new", NOW, { id: BIG_CHAT, username: "anna_t" })).toBeNull();
    expect(await links.memberOf(BIG_CHAT)).toBe(idOf(anna));
    expect(await links.find(idOf(anna))).toEqual({ username: "anna_t", linkedAt: NOW });
  });

  it("spends an expired token without linking", async () => {
    await links.issueToken(idOf(anna), "late", NOW);

    expect(await links.redeem("late", NOW, { id: 1, username: null })).toBeNull();
    expect(await prisma.telegramLinkToken.count()).toBe(0);
    expect(await links.find(idOf(anna))).toBeNull();
  });

  it("keeps one chat per member and one member per chat", async () => {
    await links.issueToken(idOf(anna), "a1", LATER);
    await links.redeem("a1", NOW, { id: 1, username: null });
    await links.issueToken(idOf(anna), "a2", LATER);
    await links.redeem("a2", NOW, { id: 2, username: null });
    await links.issueToken(idOf(boris), "b1", LATER);
    await links.redeem("b1", NOW, { id: 2, username: null });

    expect(await links.memberOf(1)).toBeNull();
    expect(await links.memberOf(2)).toBe(idOf(boris));
    expect(await links.find(idOf(anna))).toBeNull();
  });

  it("unlinks the member and drops their token, and goes with their membership", async () => {
    await links.issueToken(idOf(anna), "a1", LATER);
    await links.redeem("a1", NOW, { id: 1, username: null });
    await links.issueToken(idOf(anna), "a2", LATER);

    await links.unlink(idOf(anna));
    expect(await links.memberOf(1)).toBeNull();
    expect(await prisma.telegramLinkToken.count()).toBe(0);

    await links.issueToken(idOf(boris), "b1", LATER);
    await links.redeem("b1", NOW, { id: 3, username: null });
    await prisma.membership.delete({ where: { id: idOf(boris) } });
    expect(await prisma.telegramLink.count()).toBe(0);
  });
});

describe("a member as the bot sees them", () => {
  it("carries the role, the statuses, whether tasks are on, and the actor", async () => {
    expect(await members.describe(idOf(boris))).toEqual({
      role: "MANAGER", active: true, organizationActive: true, tasksOn: true,
      actor: { userId: boris.user.id, membershipId: idOf(boris), orgId: (await currentOrg()).id, role: "MANAGER" },
    });

    await prisma.organization.update({ where: { id: (await currentOrg()).id }, data: { modules: ["CRM"], status: "SUSPENDED" } });
    await prisma.membership.update({ where: { id: idOf(boris) }, data: { status: "SUSPENDED" } });
    expect(await members.describe(idOf(boris))).toMatchObject({ active: false, organizationActive: false, tasksOn: false });
    expect(await members.describe("00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

describe("the catalog for reading a message", () => {
  it("lists the projects the member reaches and the organization's active staff", async () => {
    const { clientId, projectId } = await seedProject("unused", "Евроопт");
    await seedProject("unused", "Клиника");
    await grantAccess(idOf(boris), clientId, projectId);
    await signInAs("Глеб", { role: "GUEST" });
    await signInAs("Клиент", { role: "CLIENT" });
    await signInAs("Ушедший", { role: "MANAGER", status: "SUSPENDED" });
    await signInAsOutsider("Чужой");

    const forAdmin = await catalogs.catalog(anna.actor!);
    const forManager = await catalogs.catalog(boris.actor!);

    expect(forAdmin.projects.map((project) => project.name)).toEqual(["Евроопт", "Клиника"]);
    expect(forManager.projects).toEqual([{ id: projectId, name: "Евроопт", client: "Евроопт" }]);
    expect(forAdmin.members.map((member) => member.name)).toEqual(["Анна", "Борис", "Глеб"]);
  });
});

describe("drafts", () => {
  const draft: TaskDraft = {
    title: "Подготовить отчёт", details: null, project: null, participants: [], unknownNames: [],
    dueDate: "2026-10-23", dueTime: null, priority: "HIGH", checklist: ["Шаг"],
  };

  it("are taken once, by their chat, while fresh", async () => {
    await drafts.save("d1", BIG_CHAT, { membershipId: idOf(anna), draft }, NOW);

    expect(await drafts.take("d1", 1, NOW)).toBeNull();
    expect(await drafts.take("d1", BIG_CHAT, LATER)).toBeNull();
    expect(await drafts.take("d1", BIG_CHAT, NOW)).toEqual({ membershipId: idOf(anna), draft });
    expect(await drafts.take("d1", BIG_CHAT, NOW)).toBeNull();
  });

  it("are swept when older than the given moment", async () => {
    await drafts.save("old", 1, { membershipId: idOf(anna), draft }, NOW);
    await drafts.save("new", 1, { membershipId: idOf(anna), draft }, LATER);

    await drafts.sweep(LATER);

    expect((await prisma.telegramTaskDraft.findMany()).map((row) => row.id)).toEqual(["new"]);
  });
});
