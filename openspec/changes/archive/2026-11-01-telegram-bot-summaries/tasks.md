## 1. KPI standing in the API

- [x] 1.1 Add `projectKpiPercent` and `kpiStanding` to `modules/kpi`, ported from the web's `kpiResult` and `toneOfPercent`
- [x] 1.2 Cover them with the cases the web tests use: accounts averaged, KPIs capped at 100, manual KPIs, disabled KPIs, unrated, thresholds

## 2. The bot's keyboards

- [x] 2.1 Make `BotReply.buttons` rows and add `menu` for the reply keyboard; move the draft card to one row
- [x] 2.2 Telegram client: several rows, the reply keyboard, `setMyCommands`, "message is not modified" taken as success
- [x] 2.3 Set the command list when the poller starts
- [x] 2.4 Cover the client's requests and the poller start

## 3. Summaries

- [x] 3.1 Add the `SummarySource` port, the periods and the summary use cases with the access check
- [x] 3.2 Render the question, the dashboard summary, the project list pages and the project summary with their buttons, in Russian
- [x] 3.3 Bot: the menu on greeting, `/start` and `/help`; **📊 Сводка** and `/summary`; the `s:` callbacks; the menu's text not taken as a task
- [x] 3.4 Wire `SummarySource` from the campaign, project and client use cases and the KPI domain
- [x] 3.5 Cover the use cases, the messages and the bot's answers, and a summary built from real figures through the wiring

## 4. Web and close

- [x] 4.1 Mention the summary in the profile's bot hints
- [x] 4.2 Run `npm test`, the web tests and the type-checks until green; `openspec validate telegram-bot-summaries --strict`
