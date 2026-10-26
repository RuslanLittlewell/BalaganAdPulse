import type { BotApi, BotCallback, BotMessage, BotReply, BotUpdate } from "#modules/telegram-bot/application/bot-api.js";
import type { DraftOutcome, TaskDraftUseCases } from "#modules/telegram-bot/application/draft-use-cases.js";
import type { TelegramLinkUseCases } from "#modules/telegram-bot/application/link-use-cases.js";
import type { TaskDraft } from "#modules/telegram-bot/domain/draft.js";
import { BOT_COPY } from "./bot-copy.js";

const START = /^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/;
const COMMAND = /^\/\w+/;
const CREATE = "create:";
const CANCEL = "cancel:";

export interface TelegramBotDependencies {
  readonly api: BotApi;
  readonly links: Pick<TelegramLinkUseCases, "redeem" | "isLinked">;
  readonly drafts: TaskDraftUseCases;
  readonly appUrl: string | null;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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
      buttons: [
        { text: BOT_COPY.create, data: `${CREATE}${outcome.id}` },
        { text: BOT_COPY.cancel, data: `${CANCEL}${outcome.id}` },
      ],
    };
  }
}

export function createTelegramBot(d: TelegramBotDependencies) {
  const reply = (chatId: number, html: string) => d.api.sendMessage(chatId, { html });

  const taskLink = (id: string) => d.appUrl ? `${d.appUrl}/tasks?task=${encodeURIComponent(id)}` : null;

  const onMessage = async (message: BotMessage) => {
    const chatId = message.chat.id;
    const text = message.text?.trim() ?? "";
    const start = START.exec(text);
    if (start) {
      const token = start[1];
      if (token) {
        const linked = await d.links.redeem(token, { id: chatId, username: message.username });
        await reply(chatId, linked ? BOT_COPY.linked : BOT_COPY.linkExpired);
        return;
      }
      await reply(chatId, (await d.links.isLinked(chatId)) ? BOT_COPY.help : BOT_COPY.notLinked);
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
    await reply(chatId, (await d.links.isLinked(chatId)) ? BOT_COPY.help : BOT_COPY.notLinked);
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
