import { beforeEach, describe, expect, it, vi } from "vitest";
import { performanceOf } from "../../src/modules/campaigns/index.js";
import {
  BOT_COPY,
  createTelegramBot,
  dashboardReply,
  draftCard,
  projectListReply,
  summaryQuestion,
  type BotUpdate,
  type DashboardSummary,
  type SummaryUseCases,
  type TaskDraft,
  type TaskDraftUseCases,
} from "../../src/modules/telegram-bot/index.js";

const CHAT = 55;

const draft: TaskDraft = {
  title: "Отчёт <для> клиента",
  details: "Сверить цифры & отправить",
  project: { id: "p-1", name: "Евроопт" },
  participants: [{ id: "boris", name: "Борис" }, { id: "vera", name: "Вера" }],
  unknownNames: ["Вася"],
  dueDate: "2026-10-23",
  dueTime: "18:00",
  priority: "URGENT",
  checklist: ["Собрать данные"],
};

const message = (fields: Partial<NonNullable<BotUpdate["message"]>>): BotUpdate => ({
  id: 1,
  callback: null,
  message: { id: 7, chat: { id: CHAT, private: true }, username: "anna", text: null, voice: null, ...fields },
});

const press = (data: string, isPrivate = true): BotUpdate => ({
  id: 2,
  message: null,
  callback: { id: "cb", data, message: { id: 9, chat: { id: CHAT, private: isPrivate } } },
});

const dashboard: DashboardSummary = {
  period: "m",
  range: { from: "2026-10-01", to: "2026-10-15" },
  currencies: [{ currency: "RUB", performance: { ...performanceOf([]), spend: 1000 } }],
  month: { from: "2026-10-01", to: "2026-10-15" },
  standings: { met: 1, behind: 0, danger: 0, none: 0 },
  lagging: [],
  moreLagging: 0,
};

let api: {
  getUpdates: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
  editMessage: ReturnType<typeof vi.fn>;
  answerCallback: ReturnType<typeof vi.fn>;
  showTyping: ReturnType<typeof vi.fn>;
  setCommands: ReturnType<typeof vi.fn>;
};
let links: { redeem: ReturnType<typeof vi.fn>; isLinked: ReturnType<typeof vi.fn> };
let drafts: { [K in keyof TaskDraftUseCases]: ReturnType<typeof vi.fn> };
let summaries: { [K in keyof SummaryUseCases]: ReturnType<typeof vi.fn> };
let bot: ReturnType<typeof createTelegramBot>;

beforeEach(() => {
  api = {
    getUpdates: vi.fn(),
    sendMessage: vi.fn(async () => undefined),
    editMessage: vi.fn(async () => undefined),
    answerCallback: vi.fn(async () => undefined),
    showTyping: vi.fn(async () => undefined),
    setCommands: vi.fn(async () => undefined),
  };
  links = { redeem: vi.fn(async () => true), isLinked: vi.fn(async () => true) };
  drafts = {
    fromVoice: vi.fn(async () => ({ kind: "drafted", id: "d1", draft, heard: "Отчёт для клиента" })),
    fromText: vi.fn(async () => ({ kind: "drafted", id: "d1", draft, heard: null })),
    create: vi.fn(async () => ({ kind: "created", task: { id: "t-1", title: "Отчёт <для> клиента" } })),
    cancel: vi.fn(async () => ({ kind: "cancelled" })),
  };
  summaries = {
    menu: vi.fn(async () => ({ kind: "ready", value: null })),
    dashboard: vi.fn(async () => ({ kind: "ready", value: dashboard })),
    projects: vi.fn(async () => ({ kind: "ready", value: { page: 0, pages: 1, projects: [] } })),
    project: vi.fn(async () => ({ kind: "gone" })),
  };
  bot = createTelegramBot({
    api,
    links,
    drafts: drafts as unknown as TaskDraftUseCases,
    summaries: summaries as unknown as SummaryUseCases,
    appUrl: "https://adpulse.example",
  });
});

const sentHtml = () => api.sendMessage.mock.calls.map(([, reply]) => reply.html);

describe("starting the bot", () => {
  it("links the chat by the token in /start and greets the member", async () => {
    await bot.handle(message({ text: "/start abc_DEF-1" }));

    expect(links.redeem).toHaveBeenCalledWith("abc_DEF-1", { id: CHAT, username: "anna" });
    expect(sentHtml()).toEqual([BOT_COPY.linked]);
  });

  it("asks for a new link when the token is spent", async () => {
    links.redeem.mockResolvedValueOnce(false);

    await bot.handle(message({ text: "/start old" }));

    expect(sentHtml()).toEqual([BOT_COPY.linkExpired]);
  });

  it("explains itself on a bare /start, /help or a sticker, as linked or not", async () => {
    await bot.handle(message({ text: "/start" }));
    await bot.handle(message({ text: "/help" }));
    links.isLinked.mockResolvedValue(false);
    await bot.handle(message({}));

    expect(sentHtml()).toEqual([BOT_COPY.help, BOT_COPY.help, BOT_COPY.notLinked]);
    expect(links.redeem).not.toHaveBeenCalled();
  });

  it("ignores groups", async () => {
    await bot.handle(message({ chat: { id: -100, private: false }, text: "/start abc" }));
    await bot.handle(press("create:d1", false));

    expect(links.redeem).not.toHaveBeenCalled();
    expect(drafts.create).not.toHaveBeenCalled();
    expect(api.sendMessage).not.toHaveBeenCalled();
  });
});

describe("a message becoming a draft", () => {
  it("drafts from a voice message and offers to create or cancel it", async () => {
    await bot.handle(message({ voice: { fileId: "f1", duration: 9 } }));

    expect(api.showTyping).toHaveBeenCalledWith(CHAT);
    expect(drafts.fromVoice).toHaveBeenCalledWith(CHAT, { fileId: "f1", duration: 9 });
    expect(api.sendMessage).toHaveBeenCalledWith(CHAT, {
      html: draftCard(draft, "Отчёт для клиента"),
      buttons: [[{ text: "Создать", data: "create:d1" }, { text: "Отмена", data: "cancel:d1" }]],
    });
  });

  it("drafts from text", async () => {
    await bot.handle(message({ text: "Купить кофе" }));

    expect(drafts.fromText).toHaveBeenCalledWith(CHAT, "Купить кофе");
  });

  it.each([
    ["unlinked", BOT_COPY.notLinked],
    ["forbidden", BOT_COPY.forbidden],
    ["too-long", BOT_COPY.tooLong],
    ["unheard", BOT_COPY.unheard],
    ["busy", BOT_COPY.busy],
  ])("answers %s with its own text", async (kind, text) => {
    drafts.fromVoice.mockResolvedValueOnce({ kind });

    await bot.handle(message({ voice: { fileId: "f1", duration: 9 } }));

    expect(api.sendMessage).toHaveBeenCalledWith(CHAT, { html: text });
  });

  it("says something went wrong when handling fails, and still reports the failure", async () => {
    drafts.fromText.mockRejectedValueOnce(new Error("database down"));

    await expect(bot.handle(message({ text: "Купить кофе" }))).rejects.toThrow("database down");
    expect(sentHtml()).toEqual([BOT_COPY.failed]);
  });

  it("shows the draft with every value escaped, the due day in Russian, and what it heard", () => {
    expect(draftCard(draft, "a < b")).toBe([
      "<b>Черновик задачи</b>",
      "",
      "<b>Отчёт &lt;для&gt; клиента</b>",
      "Сверить цифры &amp; отправить",
      "",
      "Проект: Евроопт",
      "Участники: Борис, Вера",
      "Срок: пт, 23 октября, 18:00",
      "Приоритет: срочный",
      "Чек-лист:",
      "• Собрать данные",
      "Не нашёл среди сотрудников: Вася",
      "",
      "<i>Распознано: «a &lt; b»</i>",
    ].join("\n"));
  });

  it("shows a bare draft without the optional lines", () => {
    const bare: TaskDraft = {
      ...draft, details: null, project: null, participants: [], unknownNames: [],
      dueDate: null, dueTime: null, priority: "MEDIUM", checklist: [],
    };
    expect(draftCard(bare, null)).toBe([
      "<b>Черновик задачи</b>", "", "<b>Отчёт &lt;для&gt; клиента</b>", "", "Проект: без проекта", "Приоритет: средний",
    ].join("\n"));
  });
});

describe("the draft's buttons", () => {
  it("creates the task and links to it in the app", async () => {
    await bot.handle(press("create:d1"));

    expect(drafts.create).toHaveBeenCalledWith(CHAT, "d1");
    expect(api.answerCallback).toHaveBeenCalledWith("cb");
    expect(api.editMessage).toHaveBeenCalledWith(CHAT, 9, {
      html: "Задача создана: <b>Отчёт &lt;для&gt; клиента</b>\n<a href=\"https://adpulse.example/tasks?task=t-1\">Открыть в Balagan BI</a>",
    });
  });

  it("leaves the link out when the app has no address", async () => {
    bot = createTelegramBot({
      api, links, drafts: drafts as unknown as TaskDraftUseCases, summaries: summaries as unknown as SummaryUseCases, appUrl: null,
    });

    await bot.handle(press("create:d1"));

    expect(api.editMessage).toHaveBeenCalledWith(CHAT, 9, { html: "Задача создана: <b>Отчёт &lt;для&gt; клиента</b>" });
  });

  it("cancels the draft", async () => {
    await bot.handle(press("cancel:d1"));

    expect(drafts.cancel).toHaveBeenCalledWith(CHAT, "d1");
    expect(api.editMessage).toHaveBeenCalledWith(CHAT, 9, { html: BOT_COPY.cancelled });
  });

  it("only answers that a used draft is gone, leaving the message as it is", async () => {
    drafts.create.mockResolvedValueOnce({ kind: "gone" });
    drafts.cancel.mockResolvedValueOnce({ kind: "gone" });

    await bot.handle(press("create:d1"));
    await bot.handle(press("cancel:d1"));

    expect(api.answerCallback.mock.calls).toEqual([["cb", BOT_COPY.gone], ["cb", BOT_COPY.gone]]);
    expect(api.editMessage).not.toHaveBeenCalled();
  });

  it("says when the member may no longer create tasks or the task was refused", async () => {
    drafts.create.mockResolvedValueOnce({ kind: "forbidden" }).mockResolvedValueOnce({ kind: "failed" });

    await bot.handle(press("create:d1"));
    await bot.handle(press("create:d2"));

    expect(api.editMessage.mock.calls.map(([, , reply]) => reply.html)).toEqual([BOT_COPY.forbidden, BOT_COPY.notCreated]);
  });

  it("answers a press it does not know, and one that failed", async () => {
    await bot.handle(press("something"));
    drafts.create.mockRejectedValueOnce(new Error("database down"));
    await expect(bot.handle(press("create:d1"))).rejects.toThrow("database down");

    expect(api.answerCallback.mock.calls).toEqual([["cb"], ["cb", BOT_COPY.failed]]);
  });
});

describe("the menu", () => {
  const MENU = [BOT_COPY.summary.button];

  it("puts the summary button under the field when the chat is linked", async () => {
    await bot.handle(message({ text: "/start abc" }));

    expect(api.sendMessage).toHaveBeenCalledWith(CHAT, { html: BOT_COPY.linked, menu: MENU });
  });

  it("keeps the button with the help", async () => {
    await bot.handle(message({ text: "/help" }));

    expect(api.sendMessage).toHaveBeenCalledWith(CHAT, { html: BOT_COPY.help, menu: MENU });
  });

  it("gives an unlinked chat no button", async () => {
    links.isLinked.mockResolvedValueOnce(false);

    await bot.handle(message({ text: "/start" }));

    expect(api.sendMessage).toHaveBeenCalledWith(CHAT, { html: BOT_COPY.notLinked });
  });

  it.each([BOT_COPY.summary.button, "Сводка", "/summary", "/summary@adpulse_bot"])(
    "asks what to summarise on %s, without making a task",
    async (text) => {
      await bot.handle(message({ text }));

      expect(summaries.menu).toHaveBeenCalledWith(CHAT);
      expect(api.sendMessage).toHaveBeenCalledWith(CHAT, summaryQuestion());
      expect(drafts.fromText).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["unlinked", BOT_COPY.notLinked],
    ["forbidden", BOT_COPY.summary.forbidden],
  ] as const)("answers a member who is %s without figures", async (kind, html) => {
    summaries.menu.mockResolvedValueOnce({ kind });

    await bot.handle(message({ text: BOT_COPY.summary.button }));

    expect(api.sendMessage).toHaveBeenCalledWith(CHAT, { html });
  });
});

describe("the summary's buttons", () => {
  it("redraws the message with the dashboard for the period pressed", async () => {
    await bot.handle(press("s:d:y"));

    expect(summaries.dashboard).toHaveBeenCalledWith(CHAT, "y");
    expect(api.editMessage).toHaveBeenCalledWith(CHAT, 9, dashboardReply(dashboard, "https://adpulse.example"));
    expect(api.answerCallback).toHaveBeenCalledWith("cb");
  });

  it("opens a page of the project list", async () => {
    await bot.handle(press("s:l:2"));

    expect(summaries.projects).toHaveBeenCalledWith(CHAT, 2);
    expect(api.editMessage).toHaveBeenCalledWith(CHAT, 9, projectListReply({ page: 0, pages: 1, projects: [] }));
  });

  it("says a project is not available and leads back to its page", async () => {
    await bot.handle(press("s:p:p1:pm:1"));

    expect(summaries.project).toHaveBeenCalledWith(CHAT, "p1", "pm", 1);
    expect(api.editMessage).toHaveBeenCalledWith(CHAT, 9, {
      html: BOT_COPY.summary.projectGone,
      buttons: [[{ text: BOT_COPY.summary.toProjects, data: "s:l:1" }]],
    });
  });

  it("goes back to the question", async () => {
    await bot.handle(press("s:ask"));

    expect(api.editMessage).toHaveBeenCalledWith(CHAT, 9, summaryQuestion());
  });

  it("shows no figures to a member who lost the bot", async () => {
    summaries.dashboard.mockResolvedValueOnce({ kind: "forbidden" });

    await bot.handle(press("s:d:m"));

    expect(api.editMessage).toHaveBeenCalledWith(CHAT, 9, { html: BOT_COPY.summary.forbidden });
  });

  it("only acknowledges a button it cannot read", async () => {
    await bot.handle(press("s:d:week"));

    expect(api.editMessage).not.toHaveBeenCalled();
    expect(api.answerCallback).toHaveBeenCalledWith("cb");
  });
});
