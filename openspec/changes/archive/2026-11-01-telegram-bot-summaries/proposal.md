## Why

The Telegram bot only turns messages into tasks. Away from the desk, a manager also wants to know
how the agency's projects are doing, or how one project is doing, without opening the app. The bot
already knows who the member is and what they may reach, so it can answer that from the same
figures the app shows.

## What Changes

- The bot gets a menu: a **📊 Сводка** button kept under the message field, and a `/summary`
  command in Telegram's command menu.
- **Сводка** asks what to summarise, with two buttons: **Дашборд** and **Проект**.
- **Дашборд** answers with the totals of every project the member reaches: spend, impressions,
  clicks, CTR, CPC, conversions and results, per currency, and the month's KPI standing: how many
  projects meet their KPIs, are a little or far behind, or are not rated, naming the projects
  behind.
- **Проект** answers with a list of the projects the member reaches, as buttons, a page at a time.
  Choosing one answers with that project's figures and each of its KPIs against its target.
- A summary covers this month by default; buttons under it switch it to yesterday, the last
  7 days, this month or the previous month, and lead back to the list or the choice.
- The menu's text is not taken as a task, and `/start` and `/help` mention the summary.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `telegram-task-bot`: the bot's menu, the dashboard summary and the project summary; the menu's
  text is not read as a task.

## Impact

- API: `modules/telegram-bot` (summary use cases, messages, the menu and its buttons, a keyboard
  of several rows and the reply keyboard in the Telegram client, the bot's command list);
  `modules/kpi` gains the project KPI percent and standing the web app already computes; the
  wiring hands the bot the campaign, project and client reads.
- Web: the profile's bot hint mentions the summary.
- Nothing new is sent to Groq: summaries are built from the app's data alone.
