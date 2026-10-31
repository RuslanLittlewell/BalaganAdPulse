import type { BotApi, BotCallback, BotMessage, BotReply, BotUpdate } from "#modules/telegram-bot/application/bot-api.js";
import type { DraftOutcome, TaskDraftUseCases } from "#modules/telegram-bot/application/draft-use-cases.js";
import type { TelegramLinkUseCases } from "#modules/telegram-bot/application/link-use-cases.js";
import type { SummaryOutcome, SummaryUseCases } from "#modules/telegram-bot/application/summary-use-cases.js";
import type { TaskDraft } from "#modules/telegram-bot/domain/draft.js";
import { BOT_COPY } from "./bot-copy.js";
import { escapeHtml } from "./html.js";
import {
  dashboardReply,
  projectGoneReply,
  projectListReply,
  projectReply,
  summaryQuestion,
  summaryRequest,
  type SummaryRequest,
} from "./summary-message.js";

const START = /^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/;
const COMMAND = /^\/\w+/;
const SUMMARY_COMMAND = /^\/summary(?:@\w+)?\s*$/;
const CREATE = "create:";
const CANCEL = "cancel:";

export interface TelegramBotDependencies {
  readonly api: BotApi;
  readonly links: Pick<TelegramLinkUseCases, "redeem" | "isLinked">;
  readonly drafts: TaskDraftUseCases;
  readonly summaries: SummaryUseCases;
  readonly appUrl: string | null;
}

const MENU = [BOT_COPY.summary.button];

const asksForSummary = (text: string) =>
  SUMMARY_COMMAND.test(text) || text === BOT_COPY.summary.button || text === BOT_COPY.summary.word;

export { escapeHtml };

const DUE_DAY = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", weekday: "short", timeZone: "UTC" });

export function dueText(dueDate: string | null, dueTime: string | null): string | null {
  if (dueDate === null) return null;
  const day = DUE_DAY.format(new Date(`${dueDate}T00:00:00Z`));
  return dueTime ? `${day}, ${dueTime}` : day;
}

const dueLine = (draft: TaskDraft) => dueText(draft.dueDate, draft.dueTime);

export function draftCard(draft: TaskDraft, heard: string | null): string {
  const field = (label: string, value: string) => `${label}: ${escapeHtml(value)}`;
  const due = dueLine(draft);
  return [
    `<b>${BOT_COPY.draftTitle}</b>`,
    "",
    `<b>${escapeHtml(draft.title)}</b>`,
    ...(draft.details ? [escapeHtml(draft.details)] : []),
    "",
    field(BOT_COPY.project, draft.project?.name ?? BOT_COPY.noProject),
    ...(draft.participants.length > 0
      ? [field(BOT_COPY.participants, draft.participants.map((member) => member.name).join(", "))]
      : []),
    ...(due ? [field(BOT_COPY.due, due)] : []),
    field(BOT_COPY.priority, BOT_COPY.priorities[draft.priority]),
    ...(draft.checklist.length > 0
      ? [`${BOT_COPY.checklist}:`, ...draft.checklist.map((item) => `• ${escapeHtml(item)}`)]
      : []),
    ...(draft.unknownNames.length > 0 ? [field(BOT_COPY.unknownNames, draft.unknownNames.join(", "))] : []),
    ...(heard ? ["", `<i>${BOT_COPY.heard}: «${escapeHtml(heard)}»</i>`] : []),
  ].join("\n");
}

function outcomeReply(outcome: DraftOutcome): BotReply {
  switch (outcome.kind) {
    case "unlinked": return { html: BOT_COPY.notLinked };
    case "forbidden": return { html: BOT_COPY.forbidden };
    case "too-long": return { html: BOT_COPY.tooLong };
    case "unheard": return { html: BOT_COPY.unheard };
    case "busy": return { html: BOT_COPY.busy };
    case "drafted": return {
      html: draftCard(outcome.draft, outcome.heard),
      buttons: [[
        { text: BOT_COPY.create, data: `${CREATE}${outcome.id}` },
        { text: BOT_COPY.cancel, data: `${CANCEL}${outcome.id}` },
      ]],
    };
  }
}

function summaryAnswer<T>(outcome: SummaryOutcome<T>, render: (value: T) => BotReply, page = 0): BotReply {
  switch (outcome.kind) {
    case "unlinked": return { html: BOT_COPY.notLinked };
    case "forbidden": return { html: BOT_COPY.summary.forbidden };
    case "gone": return projectGoneReply(page);
    case "ready": return render(outcome.value);
  }
}

export function createTelegramBot(d: TelegramBotDependencies) {
  const reply = (chatId: number, html: string) => d.api.sendMessage(chatId, { html });

  const guide = async (chatId: number) =>
    d.api.sendMessage(chatId, (await d.links.isLinked(chatId)) ? { html: BOT_COPY.help, menu: MENU } : { html: BOT_COPY.notLinked });

  const summary = async (chatId: number, request: SummaryRequest): Promise<BotReply> => {
    switch (request.kind) {
      case "ask":
        return summaryAnswer(await d.summaries.menu(chatId), summaryQuestion);
      case "dashboard":
        return summaryAnswer(await d.summaries.dashboard(chatId, request.period), (value) => dashboardReply(value, d.appUrl));
      case "list":
        return summaryAnswer(await d.summaries.projects(chatId, request.page), projectListReply);
      case "project":
        return summaryAnswer(
          await d.summaries.project(chatId, request.projectId, request.period, request.page),
          (value) => projectReply(value, d.appUrl),
          request.page,
        );
    }
  };

  const taskLink = (id: string) => d.appUrl ? `${d.appUrl}/tasks?task=${encodeURIComponent(id)}` : null;

  const onMessage = async (message: BotMessage) => {
    const chatId = message.chat.id;
    const text = message.text?.trim() ?? "";
    const start = START.exec(text);
    if (start) {
      const token = start[1];
      if (token) {
        const linked = await d.links.redeem(token, { id: chatId, username: message.username });
        await d.api.sendMessage(chatId, linked ? { html: BOT_COPY.linked, menu: MENU } : { html: BOT_COPY.linkExpired });
        return;
      }
      await guide(chatId);
      return;
    }
    if (asksForSummary(text)) {
      await d.api.sendMessage(chatId, await summary(chatId, { kind: "ask" }));
      return;
    }
    if (message.voice) {
      await d.api.showTyping(chatId).catch(() => undefined);
      await d.api.sendMessage(chatId, outcomeReply(await d.drafts.fromVoice(chatId, message.voice)));
      return;
    }
    if (text.length > 0 && !COMMAND.test(text)) {
      await d.api.showTyping(chatId).catch(() => undefined);
      await d.api.sendMessage(chatId, outcomeReply(await d.drafts.fromText(chatId, text)));
      return;
    }
    await guide(chatId);
  };

  const onCallback = async (callback: BotCallback) => {
    const message = callback.message;
    const data = callback.data ?? "";
    if (!message || !message.chat.private) {
      await d.api.answerCallback(callback.id);
      return;
    }
    const chatId = message.chat.id;
    const edit = (html: string) => d.api.editMessage(chatId, message.id, { html });
    const request = summaryRequest(data);
    if (request) {
      await d.api.editMessage(chatId, message.id, await summary(chatId, request));
      await d.api.answerCallback(callback.id);
      return;
    }
    if (data.startsWith(CREATE)) {
      const outcome = await d.drafts.create(chatId, data.slice(CREATE.length));
      if (outcome.kind === "gone") {
        await d.api.answerCallback(callback.id, BOT_COPY.gone);
        return;
      }
      await d.api.answerCallback(callback.id);
      if (outcome.kind === "forbidden") await edit(BOT_COPY.forbidden);
      else if (outcome.kind === "failed") await edit(BOT_COPY.notCreated);
      else {
        const link = taskLink(outcome.task.id);
        await edit([
          `${BOT_COPY.created}: <b>${escapeHtml(outcome.task.title)}</b>`,
          ...(link ? [`<a href="${escapeHtml(link)}">${BOT_COPY.open}</a>`] : []),
        ].join("\n"));
      }
      return;
    }
    if (data.startsWith(CANCEL)) {
      const outcome = await d.drafts.cancel(chatId, data.slice(CANCEL.length));
      if (outcome.kind === "gone") {
        await d.api.answerCallback(callback.id, BOT_COPY.gone);
        return;
      }
      await d.api.answerCallback(callback.id);
      await edit(BOT_COPY.cancelled);
      return;
    }
    await d.api.answerCallback(callback.id);
  };

  return {
    async handle(update: BotUpdate): Promise<void> {
      if (update.message?.chat.private) {
        const chatId = update.message.chat.id;
        try {
          await onMessage(update.message);
        } catch (error) {
          await reply(chatId, BOT_COPY.failed).catch(() => undefined);
          throw error;
        }
        return;
      }
      if (!update.callback) return;
      const callbackId = update.callback.id;
      try {
        await onCallback(update.callback);
      } catch (error) {
        await d.api.answerCallback(callbackId, BOT_COPY.failed).catch(() => undefined);
        throw error;
      }
    },
  };
}

export type TelegramBot = ReturnType<typeof createTelegramBot>;
