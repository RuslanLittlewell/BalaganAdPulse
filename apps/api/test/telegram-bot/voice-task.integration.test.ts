import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { createKernel } from "../../src/composition/wiring/kernel.js";
import { wireNotifications } from "../../src/composition/wiring/notifications.js";
import { wireClientsAndProjects } from "../../src/composition/wiring/clients-projects.js";
import { wireMembersAndPresence } from "../../src/composition/wiring/members-presence.js";
import { wireTasks } from "../../src/composition/wiring/tasks.js";
import { createTaskDraftUseCases, type ReadTask, type ReadingContext } from "../../src/modules/telegram-bot/index.js";
import {
  PrismaTaskCatalogs,
  PrismaTaskDrafts,
  PrismaTelegramLinks,
  PrismaTelegramMembers,
} from "../../src/modules/telegram-bot/infrastructure/prisma-telegram.js";
import { signInAs, type SignedIn } from "../helpers/auth.js";
import { resetDb, seedProject } from "../helpers/db.js";

const CHAT = 4242;

const kernel = createKernel();
const notices = wireNotifications(kernel);
const people = wireMembersAndPresence(kernel, wireClientsAndProjects(kernel, notices));
const { taskUseCases } = wireTasks(kernel, people, notices);
const links = new PrismaTelegramLinks(prisma);

const reader = {
  read: vi.fn(async (_text: string, context: ReadingContext): Promise<ReadTask> => ({
    title: "Подготовить отчёт",
    details: "Сверить цифры",
    projectKey: context.catalog.projects.find((project) => project.name === "Евроопт")?.key ?? null,
    participantKeys: context.catalog.members.filter((member) => member.name === "Борис").map((member) => member.key),
    unknownNames: [],
    dueDate: "2026-10-23",
    dueTime: "18:00",
    priority: "HIGH",
    checklist: ["Собрать данные"],
  })),
};

const useCases = createTaskDraftUseCases({
  links,
  members: new PrismaTelegramMembers(prisma),
  catalogs: new PrismaTaskCatalogs(prisma),
  voices: { download: async () => new Uint8Array([1]) },
  speech: { transcribe: async () => "Подготовить отчёт по Евроопту к пятнице, добавь Бориса" },
  reader,
  drafts: new PrismaTaskDrafts(prisma),
  tasks: taskUseCases,
  ids: kernel.ids,
  clock: kernel.clock,
  timeZone: "Europe/Minsk",
});

let anna: SignedIn;
let boris: SignedIn;
let projectId: string;

beforeEach(async () => {
  await resetDb();
  anna = await signInAs("Анна");
  boris = await signInAs("Борис", { role: "MANAGER" });
  ({ projectId } = await seedProject("unused", "Евроопт"));
  await links.issueToken(anna.membership!.id, "hash", new Date(Date.now() + 60_000));
  await links.redeem("hash", new Date(), { id: CHAT, username: "anna_t" });
});

afterAll(() => prisma.$disconnect());

describe("a voice message made into a task", () => {
  it("creates the task as the member, with its audit entry and a notification for the named participant", async () => {
    const drafted = await useCases.fromVoice(CHAT, { fileId: "f1", duration: 8 });
    if (drafted.kind !== "drafted") throw new Error(`Expected a draft, got ${drafted.kind}`);

    const created = await useCases.create(CHAT, drafted.id);

    expect(created.kind).toBe("created");
    const task = await prisma.task.findFirstOrThrow({ include: { participants: true, checklist: true } });
    expect(task).toMatchObject({
      title: "Подготовить отчёт",
      projectId,
      createdById: anna.membership!.id,
      column: "IDEA",
      priority: "HIGH",
      dueTime: "18:00",
      visibleToClient: false,
      description: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Сверить цифры" }] }] },
    });
    expect(task.dueDate?.toISOString().slice(0, 10)).toBe("2026-10-23");
    expect(task.participants.map((participant) => participant.membershipId).sort())
      .toEqual([anna.membership!.id, boris.membership!.id].sort());
    expect(task.checklist.map((item) => item.title)).toEqual(["Собрать данные"]);
    expect(await prisma.auditEvent.findFirst({ where: { entityId: task.id, action: "CREATE" } }))
      .toMatchObject({ actorId: anna.membership!.id, actorName: "Анна" });
    await vi.waitFor(async () => {
      expect(await prisma.notification.findMany({ where: { taskId: task.id } }))
        .toEqual([expect.objectContaining({ recipientId: boris.membership!.id, kind: "TASK_ASSIGNED" })]);
    });
    expect(await prisma.telegramTaskDraft.count()).toBe(0);
  });
});
