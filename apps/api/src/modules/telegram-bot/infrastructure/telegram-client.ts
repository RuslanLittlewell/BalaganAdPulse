import { z } from "zod";
import type { BotApi, BotChat, BotCommand, BotReply, BotUpdate } from "../application/bot-api.js";
import type { BotIdentity, VoiceFiles } from "../application/ports.js";

const TELEGRAM_ORIGIN = "https://api.telegram.org";
const REQUEST_TIMEOUT_MS = 30_000;
const POLL_GRACE_MS = 10_000;
const UNCHANGED = /message is not modified/i;

export class TelegramApiError extends Error {
  constructor(readonly method: string, readonly status: number, readonly description: string) {
    super(`Telegram ${method} failed with ${status}: ${description}`);
    this.name = "TelegramApiError";
  }
}

const envelope = z.object({
  ok: z.boolean(),
  result: z.unknown().optional(),
  description: z.string().optional(),
});

const chat = z.object({ id: z.number().int(), type: z.string() });

const message = z.object({
  message_id: z.number().int(),
  chat,
  from: z.object({ username: z.string().optional() }).optional(),
  text: z.string().optional(),
  voice: z.object({ file_id: z.string().min(1), duration: z.number().int().min(0) }).optional(),
});

const update = z.object({
  update_id: z.number().int(),
  message: message.optional(),
  callback_query: z.object({
    id: z.string().min(1),
    data: z.string().optional(),
    message: z.object({ message_id: z.number().int(), chat }).optional(),
  }).optional(),
});

const updateId = z.object({ update_id: z.number().int() });

const toChat = (raw: z.infer<typeof chat>): BotChat => ({ id: raw.id, private: raw.type === "private" });

function toUpdate(raw: unknown): BotUpdate | null {
  const parsed = update.safeParse(raw);
  if (!parsed.success) {
    const id = updateId.safeParse(raw);
    return id.success ? { id: id.data.update_id, message: null, callback: null } : null;
  }
  const { message: sent, callback_query: pressed } = parsed.data;
  return {
    id: parsed.data.update_id,
    message: sent ? {
      id: sent.message_id,
      chat: toChat(sent.chat),
      username: sent.from?.username ?? null,
      text: sent.text ?? null,
      voice: sent.voice ? { fileId: sent.voice.file_id, duration: sent.voice.duration } : null,
    } : null,
    callback: pressed ? {
      id: pressed.id,
      data: pressed.data ?? null,
      message: pressed.message ? { id: pressed.message.message_id, chat: toChat(pressed.message.chat) } : null,
    } : null,
  };
}

function keyboardOf(reply: BotReply) {
  const rows = (reply.buttons ?? []).filter((row) => row.length > 0);
  if (rows.length > 0) {
    return { inline_keyboard: rows.map((row) => row.map((button) => ({ text: button.text, callback_data: button.data }))) };
  }
  if (reply.menu && reply.menu.length > 0) {
    return { keyboard: [reply.menu.map((text) => ({ text }))], resize_keyboard: true, is_persistent: true };
  }
  return undefined;
}

const inlineOnly = (reply: BotReply) => (reply.buttons?.some((row) => row.length > 0) ? keyboardOf(reply) : undefined);

export class TelegramClient implements BotApi, BotIdentity, VoiceFiles {
  private botUsername: Promise<string> | null = null;

  constructor(
    private readonly token: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly requestTimeoutMs = REQUEST_TIMEOUT_MS,
  ) {}

  private async call(method: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
    const timeout = AbortSignal.timeout(this.requestTimeoutMs + (method === "getUpdates" ? POLL_GRACE_MS : 0));
    const response = await this.fetcher(`${TELEGRAM_ORIGIN}/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      redirect: "error",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    const parsed = envelope.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new TelegramApiError(method, response.status, "unreadable answer");
    if (!parsed.data.ok) throw new TelegramApiError(method, response.status, parsed.data.description ?? "not ok");
    return parsed.data.result;
  }

  username(): Promise<string> {
    this.botUsername ??= this.call("getMe", {})
      .then((result) => z.object({ username: z.string().min(1) }).parse(result).username)
      .catch((error: unknown) => {
        this.botUsername = null;
        throw error;
      });
    return this.botUsername;
  }

  async getUpdates(offset: number | null, timeoutSeconds: number, signal: AbortSignal): Promise<BotUpdate[]> {
    const result = await this.call("getUpdates", {
      ...(offset === null ? {} : { offset }),
      timeout: timeoutSeconds,
      allowed_updates: ["message", "callback_query"],
    }, signal);
    return z.array(z.unknown()).parse(result).map(toUpdate).filter((each): each is BotUpdate => each !== null);
  }

  async sendMessage(chatId: number, reply: BotReply): Promise<void> {
    await this.call("sendMessage", {
      chat_id: chatId, text: reply.html, parse_mode: "HTML",
      link_preview_options: { is_disabled: true }, reply_markup: keyboardOf(reply),
    });
  }

  async editMessage(chatId: number, messageId: number, reply: BotReply): Promise<void> {
    try {
      await this.call("editMessageText", {
        chat_id: chatId, message_id: messageId, text: reply.html, parse_mode: "HTML",
        link_preview_options: { is_disabled: true }, reply_markup: inlineOnly(reply),
      });
    } catch (error) {
      if (error instanceof TelegramApiError && UNCHANGED.test(error.description)) return;
      throw error;
    }
  }

  async setCommands(commands: readonly BotCommand[]): Promise<void> {
    await this.call("setMyCommands", { commands });
  }

  async answerCallback(callbackId: string, text?: string): Promise<void> {
    await this.call("answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text } : {}) });
  }

  async showTyping(chatId: number): Promise<void> {
    await this.call("sendChatAction", { chat_id: chatId, action: "typing" });
  }

  async download(fileId: string): Promise<Uint8Array> {
    const file = z.object({ file_path: z.string().min(1) }).parse(await this.call("getFile", { file_id: fileId }));
    const response = await this.fetcher(`${TELEGRAM_ORIGIN}/file/bot${this.token}/${file.file_path}`, {
      redirect: "error", signal: AbortSignal.timeout(this.requestTimeoutMs),
    });
    if (!response.ok) throw new TelegramApiError("file", response.status, "download failed");
    return new Uint8Array(await response.arrayBuffer());
  }
}
