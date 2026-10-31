## ADDED Requirements

### Requirement: The bot has a menu with a summary

The bot SHALL keep a **📊 Сводка** button under the message field of a linked chat, sent with its
greeting after linking and with its answers to `/start` and `/help`, and SHALL list `/summary`
(Сводка) and `/help` in Telegram's command menu. Pressing **📊 Сводка**, or sending `/summary`,
SHALL answer with the question what to summarise and two buttons, **Дашборд** and **Проект**. A
chat that is not linked, or a member to whom the bot is not available, SHALL get the same answer
as for a message, and no figures.

#### Scenario: Opening the summary

- **WHEN** Анна presses **📊 Сводка**
- **THEN** the bot asks what to summarise and offers **Дашборд** and **Проект**

#### Scenario: The command

- **WHEN** Анна sends `/summary`
- **THEN** the bot answers as for the button

#### Scenario: The button after linking

- **WHEN** Анна links her Telegram
- **THEN** the greeting carries the **📊 Сводка** button under the message field

#### Scenario: Not linked

- **WHEN** someone whose chat is not linked presses **📊 Сводка**
- **THEN** the bot asks them to link it from their profile and shows no figures

### Requirement: The dashboard summary

**Дашборд** SHALL answer, in place of the question, with the figures of every project the member
reaches for the period: spend, impressions, clicks, CTR, CPC, conversions and results, given per
currency when the projects bill in more than one. It SHALL add the KPI standing for the current
month, counted as the dashboard counts it, over the projects whose KPIs are tracked: how many
meet their KPIs, are a little behind, are far behind, and are not rated; and it SHALL name the
projects far behind and then a little behind, each with its percent, at most ten in all, saying
how many more there are. It SHALL end with a link to the dashboard in the app. Figures SHALL be
those the app shows the member for the same period.

#### Scenario: Two projects behind

- **WHEN** Анна reaches five projects, three meet their KPIs, Евроопт is at 54% and Гиппо at 78%
- **THEN** the summary counts 3 meeting, 1 a little behind and 1 far behind, and lists Евроопт 54% before Гиппо 78%

#### Scenario: Two currencies

- **WHEN** Анна's projects spend in RUB and in USD
- **THEN** the summary gives the figures of each currency apart, never summed together

#### Scenario: Only reachable projects

- **WHEN** a manager reaches the projects of one client only
- **THEN** the summary counts the figures and KPIs of that client's projects alone

### Requirement: The project summary

**Проект** SHALL answer, in place of the question, with the projects the member reaches as
buttons, one per row, in alphabetical order, eight to a page, with buttons to the next and the
previous page and back to the question. Choosing a project SHALL answer, in place of the list,
with the project's name and client, the period, its spend, impressions, clicks, CTR, CPC,
conversions, revenue when there is any, and its results by type, with the cost per result where
the results are of one type; then each of its enabled KPIs with its actual value against its
target for the period and its percent, marked as met, a little behind or far behind; and a link
to the project in the app. A member who reaches no project SHALL be told so. A project the
member no longer reaches SHALL be refused with a message, and no figures.

#### Scenario: Choosing a project

- **WHEN** Анна presses **Проект** and chooses Евроопт
- **THEN** the bot shows Евроопт's figures for this month, its KPIs against their targets, and a link to the project

#### Scenario: Many projects

- **WHEN** Анна reaches twenty projects
- **THEN** the list shows the first eight with a button to the next page, and the next page shows the following eight with buttons to both pages

#### Scenario: A KPI on leads

- **WHEN** Евроопт's KPI is 300 leads a month and it has 312 leads by the end of the month
- **THEN** the summary shows the KPI as met, 312 of 300, 104%

#### Scenario: No projects

- **WHEN** a manager reaches no project
- **THEN** the bot says there are no projects to summarise

#### Scenario: A project taken away

- **WHEN** Анна chooses a project from a list after she lost access to it
- **THEN** the bot says the project is not available and shows no figures

### Requirement: A summary's period can be changed

A summary SHALL cover the current month to date, in the task time zone, unless another period is
chosen. Under a summary the bot SHALL offer **Вчера**, **7 дней**, **Этот месяц** and **Прошлый
месяц**, marking the one shown, and SHALL redraw the same summary for the period pressed. Under a
project summary it SHALL also offer to go back to the list, and under the dashboard summary back
to the question. The dashboard's KPI standing SHALL stay that of the current month whatever the
period, as in the app.

#### Scenario: Yesterday

- **WHEN** Анна presses **Вчера** under Евроопт's summary
- **THEN** the same message shows Евроопт's figures for yesterday, with **Вчера** marked

#### Scenario: Back to the list

- **WHEN** Анна presses the back button under Евроопт's summary
- **THEN** the message shows the project list again

## MODIFIED Requirements

### Requirement: A voice or text message becomes a task draft

When a linked member to whom the bot is available sends a voice message of up to 120 seconds,
the bot SHALL transcribe it with Groq's Whisper in Russian; a text message that is neither a
command nor the text of the menu's button SHALL be taken as it is. The bot SHALL then ask a Groq
language model to read the text into a
draft: a title, details, a project, participants, a due date, a due time, a priority and
checklist items, giving it today's date and weekday in the task time zone, the projects the
member reaches and the active staff of the organization, the member themself marked as the
speaker. The draft SHALL keep only a project the member reaches and staff members of the
organization, and SHALL always name the member who sent the message as a participant, first; a due date SHALL be a real calendar day and a due time a time of day that comes
with a date; a missing or empty title SHALL fall back to the beginning of the text; the
priority SHALL default to MEDIUM. The bot SHALL keep the draft for a day and answer with it,
the recognised text of a voice message, the names it could not match, and the buttons
**Создать** and **Отмена**.

#### Scenario: A voice message

- **WHEN** Анна sends «Подготовить отчёт по Евроопту к пятнице, добавь Бориса, срочно»
- **THEN** the bot answers with a draft titled with the report, project Евроопт, Анна and Борис as participants, due on the coming Friday, priority URGENT, and the recognised text

#### Scenario: The sender always takes part

- **WHEN** Анна sends a message that names nobody
- **THEN** the draft names Анна as its participant

#### Scenario: A name not on the staff

- **WHEN** the message names a participant who is not among the organization's staff
- **THEN** the draft names nobody for them and the answer says whom it could not find

#### Scenario: A project the member does not reach

- **WHEN** the language model names a project the member does not reach
- **THEN** the draft has no project

#### Scenario: Too long

- **WHEN** Анна sends a voice message longer than 120 seconds
- **THEN** the bot says it is too long and sends nothing to Groq

#### Scenario: Nothing recognised

- **WHEN** the transcription comes back empty
- **THEN** the bot says it could not make out the message and keeps no draft

#### Scenario: Groq is busy

- **WHEN** Groq answers that its limit is reached
- **THEN** the bot asks to try again in a minute

#### Scenario: No longer allowed

- **WHEN** a linked member has been suspended, made a guest, or their organization has turned the Tasks module off
- **THEN** the bot says tasks are not available to them and sends nothing to Groq

#### Scenario: The menu's button is not a task

- **WHEN** Анна presses **📊 Сводка**
- **THEN** no draft is made and nothing is sent to Groq
