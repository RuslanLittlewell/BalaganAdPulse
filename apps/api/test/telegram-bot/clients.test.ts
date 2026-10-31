import { describe, expect, it, vi } from "vitest";
import { TelegramClient } from "../../src/modules/telegram-bot/infrastructure/telegram-client.js";
import {
  GroqSpeechToText,
  GroqTaskReader,
  READING_INSTRUCTIONS,
  TASK_SCHEMA,
} from "../../src/modules/telegram-bot/infrastructure/groq.js";
import { ServiceBusyError, calendarFrom, keyedCatalog, type ReadingContext } from "../../src/modules/telegram-bot/index.js";

const TOKEN = "123:secret";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const ok = (result: unknown) => json({ ok: true, result });

const callOf = (fetcher: ReturnType<typeof vi.fn>, index = 0) => {
  const [url, init] = fetcher.mock.calls[index] as [string, RequestInit];
  return { url, init, body: typeof init.body === "string" ? JSON.parse(init.body) : init.body };
};

describe("the Telegram Bot API client", () => {
  it("long-polls for messages and button presses from the given offset", async () => {
    const fetcher = vi.fn().mockResolvedValue(ok([]));
    const client = new TelegramClient(TOKEN, fetcher);

    await client.getUpdates(42, 25, new AbortController().signal);

    const { url, init, body } = callOf(fetcher);
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/getUpdates`);
    expect(init).toMatchObject({ method: "POST", redirect: "error" });
    expect(body).toEqual({ offset: 42, timeout: 25, allowed_updates: ["message", "callback_query"] });
  });

  it("reads voice, text and button presses, and keeps the id of an update it cannot read", async () => {
    const fetcher = vi.fn().mockResolvedValue(ok([
      { update_id: 1, message: { message_id: 7, chat: { id: 55, type: "private" }, from: { username: "anna" }, voice: { file_id: "f1", duration: 9 } } },
      { update_id: 2, message: { message_id: 8, chat: { id: -100, type: "group" }, text: "привет" } },
      { update_id: 3, callback_query: { id: "cb", data: "create:d1", message: { message_id: 9, chat: { id: 55, type: "private" } } } },
      { update_id: 4, message: { message_id: "broken" } },
      { nothing: true },
    ]));

    const updates = await new TelegramClient(TOKEN, fetcher).getUpdates(null, 25, new AbortController().signal);

    expect(callOf(fetcher).body).not.toHaveProperty("offset");
    expect(updates).toEqual([
      { id: 1, callback: null, message: { id: 7, chat: { id: 55, private: true }, username: "anna", text: null, voice: { fileId: "f1", duration: 9 } } },
      { id: 2, callback: null, message: { id: 8, chat: { id: -100, private: false }, username: null, text: "привет", voice: null } },
      { id: 3, message: null, callback: { id: "cb", data: "create:d1", message: { id: 9, chat: { id: 55, private: true } } } },
      { id: 4, message: null, callback: null },
    ]);
  });

  it("sends HTML with inline buttons, and edits a message dropping its buttons", async () => {
    const fetcher = vi.fn(async () => ok({}));
    const client = new TelegramClient(TOKEN, fetcher);

    await client.sendMessage(55, { html: "<b>Черновик</b>", buttons: [[{ text: "Создать", data: "create:d1" }, { text: "Отмена", data: "cancel:d1" }]] });
    await client.editMessage(55, 9, { html: "Готово" });

    expect(callOf(fetcher, 0).body).toEqual({
      chat_id: 55, text: "<b>Черновик</b>", parse_mode: "HTML", link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: [[{ text: "Создать", callback_data: "create:d1" }, { text: "Отмена", callback_data: "cancel:d1" }]] },
    });
    expect(callOf(fetcher, 1).url).toMatch(/\/editMessageText$/);
    expect(callOf(fetcher, 1).body).toEqual({
      chat_id: 55, message_id: 9, text: "Готово", parse_mode: "HTML", link_preview_options: { is_disabled: true },
    });
  });

  it("sends several rows of inline buttons", async () => {
    const fetcher = vi.fn(async () => ok({}));

    await new TelegramClient(TOKEN, fetcher).editMessage(55, 9, {
      html: "Проекты",
      buttons: [[{ text: "Евроопт", data: "s:p:p1:m:0" }], [{ text: "← Назад", data: "s:ask" }]],
    });

    expect(callOf(fetcher).body.reply_markup).toEqual({
      inline_keyboard: [[{ text: "Евроопт", callback_data: "s:p:p1:m:0" }], [{ text: "← Назад", callback_data: "s:ask" }]],
    });
  });

  it("keeps the menu's buttons under the message field", async () => {
    const fetcher = vi.fn(async () => ok({}));

    await new TelegramClient(TOKEN, fetcher).sendMessage(55, { html: "Готово", menu: ["📊 Сводка"] });

    expect(callOf(fetcher).body.reply_markup).toEqual({
      keyboard: [[{ text: "📊 Сводка" }]], resize_keyboard: true, is_persistent: true,
    });
  });

  it("lists the bot's commands", async () => {
    const fetcher = vi.fn(async () => ok(true));

    await new TelegramClient(TOKEN, fetcher).setCommands([{ command: "summary", description: "Сводка" }]);

    expect(callOf(fetcher).url).toMatch(/\/setMyCommands$/);
    expect(callOf(fetcher).body).toEqual({ commands: [{ command: "summary", description: "Сводка" }] });
  });

  it("takes an edit that changes nothing as done, and still fails on other refusals", async () => {
    const unchanged = vi.fn(async () => json({
      ok: false, description: "Bad Request: message is not modified: specified new message content and reply markup are exactly the same",
    }, 400));
    const refused = vi.fn(async () => json({ ok: false, description: "Bad Request: message to edit not found" }, 400));

    await expect(new TelegramClient(TOKEN, unchanged).editMessage(55, 9, { html: "Тот же" })).resolves.toBeUndefined();
    await expect(new TelegramClient(TOKEN, refused).editMessage(55, 9, { html: "Тот же" })).rejects.toThrow(/not found/);
  });

  it("downloads a voice file by its path", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(ok({ file_path: "voice/file_1.oga" }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));

    const audio = await new TelegramClient(TOKEN, fetcher).download("f1");

    expect(callOf(fetcher, 0).body).toEqual({ file_id: "f1" });
    expect(callOf(fetcher, 1).url).toBe(`https://api.telegram.org/file/bot${TOKEN}/voice/file_1.oga`);
    expect([...audio]).toEqual([1, 2, 3]);
  });

  it("asks for the bot's username once", async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({ id: 1, is_bot: true, username: "adpulse_bot" }));
    const client = new TelegramClient(TOKEN, fetcher);

    expect(await client.username()).toBe("adpulse_bot");
    expect(await client.username()).toBe("adpulse_bot");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fails with Telegram's description and never the token", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ ok: false, error_code: 409, description: "Conflict: terminated by other getUpdates request" }, 409));

    const failure = new TelegramClient(TOKEN, fetcher).getUpdates(null, 25, new AbortController().signal);

    await expect(failure).rejects.toThrow(/getUpdates failed with 409: Conflict/);
    await expect(failure).rejects.not.toThrow(/secret/);
  });
});

describe("the Groq clients", () => {
  it("sends the voice to Whisper in Russian and returns its text", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ text: "Подготовить отчёт" }));

    const text = await new GroqSpeechToText({ apiKey: "gsk", model: "whisper-large-v3-turbo" }, fetcher).transcribe(new Uint8Array([1, 2]));

    const { url, init, body } = callOf(fetcher);
    expect(text).toBe("Подготовить отчёт");
    expect(url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    expect(init.headers).toEqual({ Authorization: "Bearer gsk" });
    const form = body as FormData;
    expect(form.get("model")).toBe("whisper-large-v3-turbo");
    expect(form.get("language")).toBe("ru");
    expect((form.get("file") as File).name).toBe("voice.ogg");
    expect((form.get("file") as File).type).toBe("audio/ogg");
  });

  it("goes through a relay when given another base URL", async () => {
    const fetcher = vi.fn(async () => json({ text: "Ок" }));
    const relay = { apiKey: "gsk", model: "m", baseUrl: "https://relay.example.com/openai/v1" };

    await new GroqSpeechToText(relay, fetcher).transcribe(new Uint8Array([1]));
    fetcher.mockImplementation(async () => json({ choices: [{ message: { content: "{}" } }] }));
    await new GroqTaskReader(relay, fetcher).read("Купить", context);

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "https://relay.example.com/openai/v1/audio/transcriptions",
      "https://relay.example.com/openai/v1/chat/completions",
    ]);
  });

  it("turns a 429 into a busy error and any other failure into Groq's message", async () => {
    const busy = vi.fn().mockResolvedValue(json({ error: { message: "Rate limit reached" } }, 429));
    await expect(new GroqSpeechToText({ apiKey: "gsk", model: "m" }, busy).transcribe(new Uint8Array())).rejects.toBeInstanceOf(ServiceBusyError);

    const refused = vi.fn().mockResolvedValue(json({ error: { message: "Invalid API Key" } }, 401));
    await expect(new GroqSpeechToText({ apiKey: "gsk", model: "m" }, refused).transcribe(new Uint8Array())).rejects.toThrow("Groq answered 401: Invalid API Key");
  });

  const context: ReadingContext = {
    now: { date: "2026-10-19", weekday: "понедельник", time: "14:00" },
    calendar: calendarFrom("2026-10-19", 3),
    timeZone: "Europe/Minsk",
    catalog: keyedCatalog({
      projects: [{ id: "p-1", name: "Евроопт", client: "Евроторг" }],
      members: [{ id: "anna", name: "Анна" }, { id: "boris", name: "Борис" }],
    }, "anna"),
  };

  it("asks the model for the task as strict JSON, with today, the projects and the people by key", async () => {
    const answer = {
      title: "Подготовить отчёт", details: null, projectKey: "P1", participantKeys: ["M2"], unknownNames: [],
      dueDate: "2026-10-23", dueTime: null, priority: "HIGH", checklist: [],
    };
    const fetcher = vi.fn().mockResolvedValue(json({ choices: [{ message: { content: JSON.stringify(answer) } }] }));

    const read = await new GroqTaskReader({ apiKey: "gsk", model: "openai/gpt-oss-20b" }, fetcher).read("Отчёт по Евроопту", context);

    expect(read).toEqual(answer);
    const { url, init, body } = callOf(fetcher);
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init.headers).toEqual({ Authorization: "Bearer gsk", "Content-Type": "application/json" });
    expect(body).toMatchObject({
      model: "openai/gpt-oss-20b",
      temperature: 0,
      reasoning_effort: "low",
      response_format: { type: "json_schema", json_schema: { name: "task", strict: true, schema: TASK_SCHEMA } },
    });
    expect(body.messages[0]).toEqual({ role: "system", content: READING_INSTRUCTIONS });
    expect(body.messages[1].content).toBe([
      "Today: 2026-10-19, понедельник, 14:00 (Europe/Minsk)",
      "",
      "Calendar:",
      "2026-10-19 понедельник (today)",
      "2026-10-20 вторник",
      "2026-10-21 среда",
      "",
      "Projects:",
      "P1: Евроопт (client: Евроторг)",
      "",
      "People:",
      "M1: Анна (speaker)",
      "M2: Борис",
      "",
      "<message>",
      "Отчёт по Евроопту",
      "</message>",
    ].join("\n"));
  });

  it("asks a model other than gpt-oss without a reasoning effort, and reads a sloppy answer leniently", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ choices: [{ message: { content: JSON.stringify({ title: "Купить", priority: 3 }) } }] }));

    const read = await new GroqTaskReader({ apiKey: "gsk", model: "qwen/qwen3-32b" }, fetcher).read("Купить", context);

    expect(callOf(fetcher).body).not.toHaveProperty("reasoning_effort");
    expect(read).toEqual({
      title: "Купить", details: null, projectKey: null, participantKeys: [], unknownNames: [],
      dueDate: null, dueTime: null, priority: "", checklist: [],
    });
  });
});
