## 1. Linking in the API

- [x] 1.1 Add the `telegram_link`, `telegram_link_token` and `telegram_task_draft` tables with the migration; add the bot settings (`TELEGRAM_BOT_TOKEN`, `GROQ_API_KEY`, the two model overrides) to the config, compose and `.env.example`
- [x] 1.2 Build `modules/telegram-bot`: ports, the actor check, the link use cases (status, issue, unlink, redeem), the Prisma adapters, the HTTP router and its OpenAPI; mount `/api/telegram`
- [x] 1.3 Cover it: status for each role, module off and not configured; issuing replaces the token and stores only its hash; redeeming within 15 minutes, expired, used and replaced tokens; one chat per member and one member per chat; unlinking; `npm test` green

## 2. The bot in the API

- [x] 2.1 Add `draftFrom` and the description in the domain; the Telegram Bot API client; the Groq transcription and reading clients with the JSON schema and the prompt
- [x] 2.2 Add the draft use cases (from voice, from text, create, cancel) and the draft repository; hand the task use cases out of `wireTasks`
- [x] 2.3 Add the bot (`/start`, `/help`, voice, text, the buttons, private chats only), its copy, and the long-polling loop; start and stop it with the server when configured
- [x] 2.4 Cover it: `draftFrom` (keys, dates, times, title fallback, priority, checklist); the clients' requests and errors against a fake fetch; the use cases (too long, empty, busy, access lost, unknown names, single use, cancel, a day old, another chat); the bot's answers; the poller's offset, back-off and stop; a draft created into a real task with its audit and notification; `npm test` green

## 3. The profile in the web app

- [x] 3.1 Add `features/telegram-bot`: the API and its queries, `TelegramBotSection`; place it in the profile dialog; add the copy to `ru.ts`
- [x] 3.2 Cover it: hidden when not available, linking shows the Telegram link and turns to linked when the status does, unlinking; `npm run test:web` green
- [x] 3.3 Describe the bot and its settings in README.md; `openspec validate telegram-task-bot --strict`
