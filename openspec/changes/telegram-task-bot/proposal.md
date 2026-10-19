## Why

An agency's people think of tasks away from the desk: on a call, in a car, between meetings.
Opening the board and filling in a form is what keeps those tasks from being written down.
A Telegram bot that takes a voice message and turns it into a task on the board lets them
capture it in the few seconds they have.

## What Changes

- A member links their Telegram account from their profile: the app gives a one-time link to
  the bot, valid for 15 minutes; opening it and pressing Start ties the Telegram chat to the
  member. The profile shows the linked account and can unlink it.
- The bot is offered to the agency's admins and managers, the staff who create tasks, in an
  organization with the Tasks module on, and only when the server is configured with a bot
  token and a Groq API key.
- A linked member sends the bot a voice message of up to two minutes, or a text message. The
  voice is transcribed by Groq's Whisper, and a Groq language model reads the text into a task
  draft: title, details, project, participants, due date and time, priority and checklist,
  choosing the project and participants only from those the member reaches.
- The bot answers with the draft and the recognised text, naming anyone it could not find, and
  two buttons: **Создать** creates the task on the board as the member, exactly as if they had
  made it in the app, and **Отмена** drops it. A draft is kept for a day.
- The bot receives updates by long polling, so it needs no public address, webhook or nginx
  change.
- API: `GET /api/telegram`, `POST /api/telegram/link` and `DELETE /api/telegram/link`.

## Capabilities

### New Capabilities

- `telegram-task-bot`: linking a Telegram account, who may use the bot, turning a voice or
  text message into a task draft, and confirming or cancelling it.

### Modified Capabilities

None.

## Impact

- Prisma: `telegram_link`, `telegram_link_token` and `telegram_task_draft` tables, each
  deleted with its membership. Existing data is untouched.
- Configuration: `TELEGRAM_BOT_TOKEN` and `GROQ_API_KEY` turn the bot on;
  `GROQ_TRANSCRIPTION_MODEL` (`whisper-large-v3-turbo`) and `GROQ_TASK_MODEL`
  (`openai/gpt-oss-20b`) may override the models.
- API: a new `modules/telegram-bot` (domain, use cases, the Telegram and Groq clients, Prisma
  adapters, the HTTP router and OpenAPI, the bot and its long-polling loop); `wireTasks` hands
  out the task use cases; the server starts and stops the bot.
- Web: a Telegram section in the profile dialog, `features/telegram-bot`, copy in `ru.ts`.
- External services: Telegram Bot API and Groq. Groq's free tier covers several thousand voice
  messages a day. Voice recordings and their text are sent to Groq; nothing else about the
  organization is, beyond the names of the projects and colleagues the member reaches.
