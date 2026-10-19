## Context

Tasks are created through `createTaskUseCases(...).create(actor, input)`, which checks the
actor's role, the project's reach and the participants, writes the audit entry inside the
transaction, publishes the realtime event and tells the named participants. The audit writer
reads request metadata only when there is a request, so the use case works for an actor that
does not come from HTTP. A user has one active membership; the session resolves the first one.

The server runs in Belarus. Telegram's Bot API is reachable from there; Groq lists Russia but
not Belarus among the regions it refuses. OpenAI's API and the Gemini API are not offered in
Belarus, which is why Groq was chosen.

## Goals / Non-Goals

**Goals:** linking a Telegram chat to a member; a voice or text message becoming a draft read
by a language model; the member confirming it into a real task with all the usual effects.

**Non-Goals:** editing a draft in the chat (the member cancels and dictates again); sending
notifications to Telegram; clients raising tasks through the bot; any other command than
`/start` and `/help`; a webhook.

## Decisions

### Linking by a one-time deep link

The profile asks `POST /api/telegram/link`, which stores the SHA-256 hash of 24 random bytes,
encoded base64url (32 characters, inside Telegram's 64-character `start` parameter) for 15
minutes, one per membership. `/start <token>` takes the token by its hash in one conditional
delete, so a token is used once even when two messages race. The link row is keyed by the
membership, and its chat id is unique; linking deletes any row holding the chat or the
membership first. The bot's username, needed for the link, comes from `getMe` once and is
cached.

The alternative, a code the member types into the bot, costs a step and a second screen.

### Who may use it, checked at every message

`TelegramActors.resolve(membershipId)` reads the membership, its organization's status and
modules, and returns an `ActorContext` only for an active ADMIN or MANAGER of an active
organization with TASKS. It runs for every message and every button, so a suspension or a
module switched off takes effect at once, and nothing is sent to Groq for someone who may not
use it. The same check answers `GET /api/telegram`.

Clients are left out: a client's task must have a project and may name nobody, so the draft
would need different rules; they can come later.

### Long polling, in the API process

The bot calls `getUpdates` with a 25-second timeout in a loop started and stopped with the
server, like the other workers, so it needs no public URL, no TLS and no nginx change, and
works the same on a laptop. Production runs one app container, so there is one poller; a second
poller with the same token would get 409 from Telegram, so development uses its own bot. Each
update is handled without holding up the loop; the poller keeps the in-flight handlers and
waits for them on stop. The offset is kept in memory: after a restart Telegram resends what was
not confirmed, which may repeat a draft but never a task, since creating takes a button that
consumes the draft.

### Transcription and reading

Voice: `getFile`, download the OGG/Opus file (well inside Groq's 25 MB), then
`POST /openai/v1/audio/transcriptions` with `model`, `language=ru`, `temperature=0`. A voice
over 120 seconds is refused before downloading.

Reading: `POST /openai/v1/chat/completions` with `response_format: json_schema`, `strict: true`
and `reasoning_effort: low`. The prompt gives today's date, weekday and time in
`TASK_TIME_ZONE`, the reachable projects as `P1: name (client)` and the active staff as
`M1: name`, the member marked as the speaker, and the message inside `<message>` tags. The
model answers with keys, never ids or names, so duplicates and spelling do not matter:

```
title: string, details: string | null, projectKey: string | null,
participantKeys: string[], unknownNames: string[], dueDate: string | null,
dueTime: string | null, priority: LOW | MEDIUM | HIGH | URGENT, checklist: string[]
```

Strict mode on Groq needs every property required, so absence is `null` or `[]`.
`draftFrom` in the domain maps the keys back to ids, drops unknown keys, validates the date and
time with the task schedule's own rules, drops a time without a date, falls back to the first 80
characters of the text for a title, deduplicates participants and caps the checklist at 20
items. The description is a document of one paragraph per line of `details`.

The model only fills in fields that are validated afterwards and confirmed by the member, so a
message that tries to steer it can at most produce a draft the member cancels.

### Drafts in the database

`telegram_task_draft` keeps the membership, the chat and the draft as JSON. **Создать** and
**Отмена** carry `create:<id>` / `cancel:<id>` (within the 64-byte callback limit). Taking a
draft is a delete returning the row, filtered by id, chat and age, so it is used once. Drafts
older than a day are swept when a new one is written. A table rather than memory keeps a draft
across a restart and makes the single use hold even with two processes.

### Copy

The bot's texts are Russian, written in `presentation/telegram/bot-copy.ts`. They are read in
Telegram, not in the web app, so they do not belong in `ru.ts`. The draft is sent with
`parse_mode: HTML`, every value escaped.

### Configuration

`TELEGRAM_BOT_TOKEN` and `GROQ_API_KEY` must both be set for the bot to start; either missing
leaves the feature off without failing the server. `GROQ_TRANSCRIPTION_MODEL` and
`GROQ_TASK_MODEL` override `whisper-large-v3-turbo` and `openai/gpt-oss-20b`. The bot token
sits in the Bot API's URL path, so request URLs are never logged.

### Web

`features/telegram-bot` holds the API, its queries and `TelegramBotSection`, shown in the
profile dialog when the bot is available. **Подключить** asks for a link and shows it as an
**Открыть Telegram** link button rather than opening a tab after the request, which a pop-up
blocker would stop. While a link is out and not yet used, the status is polled every three
seconds and on focus, so the section turns to «Подключён» as soon as the member presses Start.

## Risks / Trade-offs

- Groq's free limits are per organization account (about 2,000 transcriptions a day) and
  their numbers change; a busy answer is told to the member as such.
- Groq could start refusing Belarus. The two calls sit behind ports, so another
  OpenAI-compatible provider is a new adapter or a different base URL.
- Voice and text go to Groq, a US service; the project and colleague names go with them.
- The model may misread a date or a name; the member sees the draft before anything is created.
