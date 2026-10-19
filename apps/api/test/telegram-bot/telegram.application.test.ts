import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@adpulse/access-policy";
import { AppError } from "../../src/shared/domain/index.js";
import {
  DRAFT_TTL_MS,
  LINK_TOKEN_TTL_MS,
  ServiceBusyError,
  createTaskDraftUseCases,
  createTelegramLinkUseCases,
  type ReadTask,
  type StoredDraft,
  type TaskDraftDependencies,
  type TelegramChat,
  type TelegramLinks,
  type TelegramMembers,
} from "../../src/modules/telegram-bot/index.js";

const NOW = new Date("2026-10-19T11:00:00Z");
const CHAT = 1001;

let now: Date;
const clock = { now: () => now };

interface Member {
  role: Role;
  active: boolean;
  organizationActive: boolean;
  tasksOn: boolean;
}

let members: Map<string, Member>;
const memberPort: TelegramMembers = {
  describe: async (id) => {
    const member = members.get(id);
    return member ? { ...member, actor: { userId: `u-${id}`, membershipId: id, orgId: "org", role: member.role } } : null;
  },
};

function linksFake() {
  const tokens = new Map<string, { membershipId: string; expiresAt: Date }>();
  const chats = new Map<number, { membershipId: string; username: string | null; linkedAt: Date }>();
  const links: TelegramLinks = {
    find: async (membershipId) => {
      const link = [...chats.values()].find((each) => each.membershipId === membershipId);
      return link ? { username: link.username, linkedAt: link.linkedAt } : null;
    },
    memberOf: async (chatId) => chats.get(chatId)?.membershipId ?? null,
    issueToken: async (membershipId, hash, expiresAt) => {
      for (const [key, token] of tokens) if (token.membershipId === membershipId) tokens.delete(key);
      tokens.set(hash, { membershipId, expiresAt });
    },
    redeem: async (hash, at, chat: TelegramChat) => {
      const token = tokens.get(hash);
      tokens.delete(hash);
      if (!token || token.expiresAt <= at) return null;
      for (const [key, link] of chats) if (link.membershipId === token.membershipId) chats.delete(key);
      chats.set(chat.id, { membershipId: token.membershipId, username: chat.username, linkedAt: at });
      return token.membershipId;
    },
    unlink: async (membershipId) => {
      for (const [key, link] of chats) if (link.membershipId === membershipId) chats.delete(key);
    },
  };
  return { links, tokens, chats };
}

let counter: number;
const tokens = {
  issue: () => {
    counter += 1;
    return { token: `token-${counter}`, hash: `hash:token-${counter}` };
  },
  hash: (token: string) => `hash:${token}`,
};

const admin = { userId: "u-anna", membershipId: "anna", orgId: "org", role: "ADMIN" as const };

beforeEach(() => {
  now = NOW;
  counter = 0;
  members = new Map([
    ["anna", { role: "ADMIN", active: true, organizationActive: true, tasksOn: true }],
    ["boris", { role: "MANAGER", active: true, organizationActive: true, tasksOn: true }],
    ["gleb", { role: "GUEST", active: true, organizationActive: true, tasksOn: true }],
  ]);
});

describe("linking a Telegram chat", () => {
  const setup = (configured = true) => {
    const fake = linksFake();
    const useCases = createTelegramLinkUseCases({
      links: fake.links, members: memberPort, tokens, clock,
      identity: configured ? { username: async () => "adpulse_bot" } : null,
    });
    return { ...fake, useCases };
  };

  it("issues a link to the bot that holds a token valid for fifteen minutes", async () => {
    const { useCases, tokens: stored } = setup();

    const link = await useCases.issueLink(admin);

    expect(link).toEqual({
      url: "https://t.me/adpulse_bot?start=token-1",
      expiresAt: new Date(NOW.getTime() + LINK_TOKEN_TTL_MS),
    });
    expect([...stored.keys()]).toEqual(["hash:token-1"]);
  });

  it("links the chat that sends the token, once, and shows it in the status", async () => {
    const { useCases } = setup();
    await useCases.issueLink(admin);

    expect(await useCases.redeem("token-1", { id: CHAT, username: "anna_t" })).toBe(true);
    expect(await useCases.redeem("token-1", { id: 2002, username: null })).toBe(false);
    expect(await useCases.status(admin)).toEqual({
      available: true, linked: true, username: "anna_t", linkedAt: NOW,
    });
    expect(await useCases.isLinked(CHAT)).toBe(true);
  });

  it("refuses a token past its fifteen minutes and one replaced by a newer link", async () => {
    const { useCases } = setup();
    await useCases.issueLink(admin);
    await useCases.issueLink(admin);

    expect(await useCases.redeem("token-1", { id: CHAT, username: null })).toBe(false);
    now = new Date(NOW.getTime() + LINK_TOKEN_TTL_MS);
    expect(await useCases.redeem("token-2", { id: CHAT, username: null })).toBe(false);
    expect(await useCases.redeem("", { id: CHAT, username: null })).toBe(false);
  });

  it("unlinks the member", async () => {
    const { useCases } = setup();
    await useCases.issueLink(admin);
    await useCases.redeem("token-1", { id: CHAT, username: null });

    await useCases.unlink(admin);

    expect((await useCases.status(admin)).linked).toBe(false);
    expect(await useCases.isLinked(CHAT)).toBe(false);
  });

  it("is not offered to a guest, nor anyone when the server has no bot", async () => {
    const guest = { ...admin, membershipId: "gleb", role: "GUEST" as const };
    const configured = setup();
    expect((await configured.useCases.status(guest)).available).toBe(false);
    await expect(configured.useCases.issueLink(guest)).rejects.toMatchObject({ category: "not-found" });

    const bare = setup(false);
    expect(await bare.useCases.status(admin)).toEqual({ available: false, linked: false, username: null, linkedAt: null });
    await expect(bare.useCases.issueLink(admin)).rejects.toMatchObject({ category: "not-found" });
  });
});

describe("a message turned into a draft and a task", () => {
  const reading = (overrides: Partial<ReadTask> = {}): ReadTask => ({
    title: "Подготовить отчёт", details: "Сверить цифры", projectKey: "P1", participantKeys: ["M2"],
    unknownNames: ["Вася"], dueDate: "2026-10-23", dueTime: null, priority: "URGENT", checklist: [],
    ...overrides,
  });

  const setup = () => {
    const chats = new Map<number, string>([[CHAT, "anna"]]);
    const drafts = new Map<string, { chatId: number; stored: StoredDraft; at: Date }>();
    const created: unknown[] = [];
    const dependencies = {
      links: { memberOf: async (chatId: number) => chats.get(chatId) ?? null },
      members: memberPort,
      catalogs: {
        catalog: vi.fn(async () => ({
          projects: [{ id: "p-1", name: "Евроопт", client: "Евроторг" }],
          members: [{ id: "anna", name: "Анна" }, { id: "boris", name: "Борис" }],
        })),
      },
      voices: { download: vi.fn(async () => new Uint8Array([1, 2, 3])) },
      speech: { transcribe: vi.fn(async () => " Подготовить отчёт по Евроопту ") },
      reader: { read: vi.fn(async () => reading()) },
      drafts: {
        save: async (id: string, chatId: number, stored: StoredDraft, at: Date) => { drafts.set(id, { chatId, stored, at }); },
        take: async (id: string, chatId: number, notBefore: Date) => {
          const draft = drafts.get(id);
          if (!draft || draft.chatId !== chatId || draft.at < notBefore) return null;
          drafts.delete(id);
          return draft.stored;
        },
        sweep: vi.fn(async () => undefined),
      },
      tasks: {
        create: vi.fn(async (_actor: unknown, input: { title: string }) => {
          created.push(input);
          return { id: "task-1", title: input.title };
        }),
      },
      ids: { generate: () => `draft-${drafts.size + 1}` },
      clock,
      timeZone: "Europe/Minsk",
    } satisfies TaskDraftDependencies;
    return { useCases: createTaskDraftUseCases(dependencies), dependencies, chats, drafts, created };
  };

  it("transcribes a voice message and drafts a task from it", async () => {
    const { useCases, dependencies } = setup();

    const outcome = await useCases.fromVoice(CHAT, { fileId: "file-1", duration: 12 });

    expect(dependencies.voices.download).toHaveBeenCalledWith("file-1");
    expect(dependencies.reader.read).toHaveBeenCalledWith("Подготовить отчёт по Евроопту", {
      now: { date: "2026-10-19", weekday: "понедельник", time: "14:00" },
      calendar: expect.arrayContaining([{ date: "2026-10-23", weekday: "пятница" }]),
      timeZone: "Europe/Minsk",
      catalog: expect.objectContaining({
        members: [
          { id: "anna", name: "Анна", key: "M1", speaker: true },
          { id: "boris", name: "Борис", key: "M2", speaker: false },
        ],
      }),
    });
    expect(outcome).toEqual({
      kind: "drafted",
      id: "draft-1",
      heard: "Подготовить отчёт по Евроопту",
      draft: {
        title: "Подготовить отчёт", details: "Сверить цифры", project: { id: "p-1", name: "Евроопт" },
        participants: [{ id: "boris", name: "Борис" }], unknownNames: ["Вася"],
        dueDate: "2026-10-23", dueTime: null, priority: "URGENT", checklist: [],
      },
    });
    expect(dependencies.drafts.sweep).toHaveBeenCalledWith(new Date(NOW.getTime() - DRAFT_TTL_MS));
  });

  it("takes a text message as it is, without transcribing", async () => {
    const { useCases, dependencies } = setup();

    const outcome = await useCases.fromText(CHAT, "  Купить кофе  ");

    expect(dependencies.speech.transcribe).not.toHaveBeenCalled();
    expect(dependencies.reader.read).toHaveBeenCalledWith("Купить кофе", expect.anything());
    expect(outcome).toMatchObject({ kind: "drafted", heard: null });
  });

  it("refuses a voice over two minutes before downloading it", async () => {
    const { useCases, dependencies } = setup();

    expect(await useCases.fromVoice(CHAT, { fileId: "file-1", duration: 121 })).toEqual({ kind: "too-long" });
    expect(dependencies.voices.download).not.toHaveBeenCalled();
  });

  it("says when nothing was heard and keeps no draft", async () => {
    const { useCases, dependencies, drafts } = setup();
    dependencies.speech.transcribe.mockResolvedValueOnce("   ");

    expect(await useCases.fromVoice(CHAT, { fileId: "file-1", duration: 3 })).toEqual({ kind: "unheard" });
    expect(dependencies.reader.read).not.toHaveBeenCalled();
    expect(drafts.size).toBe(0);
  });

  it("says Groq is busy when it is over its limit", async () => {
    const { useCases, dependencies } = setup();
    dependencies.reader.read.mockRejectedValueOnce(new ServiceBusyError("Groq"));

    expect(await useCases.fromText(CHAT, "Купить кофе")).toEqual({ kind: "busy" });
  });

  it("sends nothing to Groq for an unlinked chat or a member who may no longer use the bot", async () => {
    const { useCases, dependencies } = setup();

    expect(await useCases.fromText(4040, "Купить кофе")).toEqual({ kind: "unlinked" });
    members.set("anna", { ...members.get("anna")!, tasksOn: false });
    expect(await useCases.fromVoice(CHAT, { fileId: "file-1", duration: 3 })).toEqual({ kind: "forbidden" });
    expect(dependencies.voices.download).not.toHaveBeenCalled();
    expect(dependencies.reader.read).not.toHaveBeenCalled();
  });

  it("creates the task as the member who sent it, once", async () => {
    const { useCases, dependencies } = setup();
    await useCases.fromText(CHAT, "Подготовить отчёт");

    expect(await useCases.create(CHAT, "draft-1")).toEqual({ kind: "created", task: { id: "task-1", title: "Подготовить отчёт" } });
    expect(await useCases.create(CHAT, "draft-1")).toEqual({ kind: "gone" });
    expect(dependencies.tasks.create).toHaveBeenCalledTimes(1);
    expect(dependencies.tasks.create).toHaveBeenCalledWith(
      { userId: "u-anna", membershipId: "anna", orgId: "org", role: "ADMIN" },
      {
        title: "Подготовить отчёт",
        description: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Сверить цифры" }] }] },
        projectId: "p-1",
        priority: "URGENT",
        participantIds: ["boris"],
        dueDate: "2026-10-23",
        dueTime: null,
        checklist: [],
      },
    );
  });

  it("cancels a draft, after which neither button works", async () => {
    const { useCases, dependencies } = setup();
    await useCases.fromText(CHAT, "Подготовить отчёт");

    expect(await useCases.cancel(CHAT, "draft-1")).toEqual({ kind: "cancelled" });
    expect(await useCases.cancel(CHAT, "draft-1")).toEqual({ kind: "gone" });
    expect(await useCases.create(CHAT, "draft-1")).toEqual({ kind: "gone" });
    expect(dependencies.tasks.create).not.toHaveBeenCalled();
  });

  it("finds no draft a day old, of another chat, or of a chat linked to someone else since", async () => {
    const { useCases, chats } = setup();
    await useCases.fromText(CHAT, "Первая");
    await useCases.fromText(CHAT, "Вторая");
    await useCases.fromText(CHAT, "Третья");
    chats.set(2002, "boris");

    expect(await useCases.create(2002, "draft-1")).toEqual({ kind: "gone" });
    now = new Date(NOW.getTime() + DRAFT_TTL_MS + 1);
    expect(await useCases.create(CHAT, "draft-2")).toEqual({ kind: "gone" });
    now = NOW;
    chats.set(CHAT, "boris");
    expect(await useCases.create(CHAT, "draft-3")).toEqual({ kind: "gone" });
  });

  it("creates nothing for a member suspended since the draft, and says when the task is refused", async () => {
    const { useCases, dependencies } = setup();
    await useCases.fromText(CHAT, "Первая");
    await useCases.fromText(CHAT, "Вторая");

    members.set("anna", { ...members.get("anna")!, active: false });
    expect(await useCases.create(CHAT, "draft-1")).toEqual({ kind: "forbidden" });
    members.set("anna", { ...members.get("anna")!, active: true });
    dependencies.tasks.create.mockRejectedValueOnce(new AppError("validation", "A suspended member cannot be named on a task"));
    expect(await useCases.create(CHAT, "draft-2")).toEqual({ kind: "failed" });
  });
});
