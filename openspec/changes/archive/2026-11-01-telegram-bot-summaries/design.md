## Context

The bot (`modules/telegram-bot`) long-polls Telegram, links a chat to a membership, and answers
messages and inline button presses. Today an inline keyboard has one row, and there is no reply
keyboard or command list. Access goes through `botActorOf`: an active ADMIN or MANAGER of an
active organization with Tasks on.

The figures the bot needs already exist as campaign use cases: `projectsSummary` gives each
reachable project's typed performance, its KPIs and the figures of the accounts its KPIs name;
`agencySummary` gives the performance per currency. A project's KPI percent and its standing
(met from 90%, a little behind from 70%, far behind below that, unrated without a measurable KPI)
are computed in the web app only (`kpiResult`, `toneOfPercent`); the API has the single-KPI
`kpiPercent`.

## Goals / Non-Goals

**Goals:**

- Summaries built from the same use cases and rules as the app, so the bot and the app agree.
- No new tables: the state of a conversation lives in the buttons.

**Non-Goals:**

- Questions in free words, scheduled digests, charts, summaries for clients or guests.

## Decisions

- **Stateless buttons.** Callback data carries everything:
  - `s:ask` opens the question;
  - `s:d:<period>` opens the dashboard;
  - `s:l:<page>` opens a page of the project list;
  - `s:p:<projectId>:<period>` opens a project.

  The period is one of `y`, `7d`, `m` and `pm`, and the longest value fits Telegram's 64 bytes.
  Every press re-checks the chat's link and the member's access, so an old message cannot reveal
  more than the member may see now. Storing a conversation state per chat was rejected: it adds
  a table and expiry for nothing the buttons cannot carry.
- **One message, edited in place.** **Сводка** sends one message; every later press edits it,
  so a chat does not fill with summaries. Telegram answers "message is not modified" when the
  same period is pressed again; the client treats that answer as success.
- **Menu.** A reply keyboard with the one **📊 Сводка** button (`resize_keyboard`,
  `is_persistent`) is attached to the greeting and to `/start` and `/help`. Telegram keeps it
  until it is replaced, so it does not need resending. `setMyCommands` lists `/summary` and
  `/help` when the poller starts; a failure there is logged and the bot runs on. The button's
  text, with or without the emoji, and `/summary` are matched before a message is taken as a
  task.
- **Keyboard rows.** `BotReply.buttons` becomes rows of buttons, and the task draft keeps its
  two buttons in one row. `BotReply.menu` asks the client for the reply keyboard instead. A
  message carries one or the other, as Telegram allows one markup per message.
- **Figures port.** The bot module defines a `SummarySource` port that returns plain summaries:
  the reachable projects with client names, a project's figures and KPI lines, and the dashboard
  totals and standings. The composition wiring implements it with the campaign use cases
  (`projectsSummary`, `agencySummary`), the project and client lists, and the KPI domain, so
  the bot module does not import the campaign module's internals. A project summary reads
  `projectsSummary` and picks the project. This costs as much as the dashboard, but it brings the
  KPI account figures with it, and the projects summary is the read the app already makes for its
  project list.
- **KPI standing on the server.** `modules/kpi` gains `projectKpiPercent` and `kpiStanding`,
  ported from the web's `kpiResult` and `toneOfPercent`. A project's percent is the average over
  its KPI accounts of the average of their KPIs, each capped at 100, and manual KPIs count. A
  KPI line in the project summary uses `kpiPercent` with the same thresholds. The two copies
  share fixtures in their tests so they keep agreeing.
- **Days.** Periods are computed from today in the task time zone, the one the bot already uses
  for due dates, with the same shortcuts as the web period control.
- **Formatting.** Numbers, money and percents use `Intl` with `ru-RU`. Money is shown in the
  project's or the group's currency, whole units above 100 and two decimals below. A figure that
  cannot be computed, such as CTR without impressions, is shown as a dash. Text is HTML-escaped as
  the draft card is.

## Risks / Trade-offs

- [The KPI standing exists twice, in the web app and the API] → Both follow the same spec rule,
  and their tests share the same cases. Moving the web app onto the API's standing is a separate
  change.
- [A manager with very many projects waits for `projectsSummary` on every press] → It is the
  same read the dashboard makes. If it turns out slow, a project summary can read one project
  instead, without changing the messages.
- [Telegram limits a message to 4096 characters] → The lagging list stops at ten projects, a list
  page holds eight, and project names are cut to fit a button.
