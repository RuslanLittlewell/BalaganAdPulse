## Purpose

Let the agency's staff put a task on the board by sending a voice or text message to a
Telegram bot linked to their account, confirming the draft the bot reads out of it.

## ADDED Requirements

### Requirement: The bot is offered to the staff who create tasks

The bot SHALL be available to a member only when the server is configured with both a Telegram
bot token and a Groq API key, the member is an active ADMIN or MANAGER, and their organization
is active with the Tasks module on. `GET /api/telegram` SHALL tell the member whether the bot is
available to them, whether their Telegram is linked, the Telegram username it is linked to, if
any, and when it was linked. Linking SHALL be refused with 404 when the bot is not available to
the member.

#### Scenario: Not configured

- **WHEN** the server has no bot token or no Groq API key and an admin reads `GET /api/telegram`
- **THEN** the answer says the bot is not available, and `POST /api/telegram/link` answers 404

#### Scenario: A guest or a client

- **WHEN** a GUEST, CLIENT or CLIENT_ADMIN reads `GET /api/telegram` on a configured server
- **THEN** the answer says the bot is not available to them

#### Scenario: Tasks module off

- **WHEN** the organization has the Tasks module off
- **THEN** the bot is not available to any of its members

### Requirement: A member links their Telegram through a one-time link

`POST /api/telegram/link` SHALL issue the member a link `https://t.me/<bot>?start=<token>` that
holds a random token, valid for 15 minutes, replacing any token the member was issued before.
Only a hash of the token SHALL be stored. When a Telegram user opens the link and sends
`/start <token>` in a private chat with the bot, the bot SHALL link that chat to the member,
consume the token, record the Telegram username, and greet the member with how to use it. A
chat SHALL be linked to one member and a member to one chat: linking again replaces the
previous link on either side. `DELETE /api/telegram/link` SHALL unlink the member. A link SHALL
be deleted with its membership.

#### Scenario: Linking

- **WHEN** Анна asks for a link and sends `/start <token>` from her Telegram within 15 minutes
- **THEN** her chat is linked to her, the bot greets her, and `GET /api/telegram` shows her as linked with her username

#### Scenario: An expired or used token

- **WHEN** someone sends `/start` with a token older than 15 minutes, already used, or never issued
- **THEN** nothing is linked and the bot asks them to take a new link from their profile

#### Scenario: Another link replaces the first

- **WHEN** Анна asks for a second link and uses the first token
- **THEN** nothing is linked

#### Scenario: Unlinking

- **WHEN** Анна unlinks her Telegram in the app and then messages the bot
- **THEN** the bot no longer takes her messages and asks her to link it from her profile

#### Scenario: Group chats are ignored

- **WHEN** the bot receives a message in a group
- **THEN** it does nothing

### Requirement: A voice or text message becomes a task draft

When a linked member to whom the bot is available sends a voice message of up to 120 seconds,
the bot SHALL transcribe it with Groq's Whisper in Russian; a text message that is not a command
SHALL be taken as it is. The bot SHALL then ask a Groq language model to read the text into a
draft: a title, details, a project, participants, a due date, a due time, a priority and
checklist items, giving it today's date and weekday in the task time zone, the projects the
member reaches and the active staff of the organization, the member themself marked as the
speaker. The draft SHALL keep only a project the member reaches and staff members of the
organization; a due date SHALL be a real calendar day and a due time a time of day that comes
with a date; a missing or empty title SHALL fall back to the beginning of the text; the
priority SHALL default to MEDIUM. The bot SHALL keep the draft for a day and answer with it,
the recognised text of a voice message, the names it could not match, and the buttons
**Создать** and **Отмена**.

#### Scenario: A voice message

- **WHEN** Анна sends «Подготовить отчёт по Евроопту к пятнице, добавь Бориса, срочно»
- **THEN** the bot answers with a draft titled with the report, project Евроопт, Борис as participant, due on the coming Friday, priority URGENT, and the recognised text

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

### Requirement: Confirming the draft creates the task as the member

**Создать** SHALL create the task from the draft as the member who sent the message, through
the same rules, audit, realtime update and notifications as a task made in the app, in the
board's first column, and the bot SHALL replace the draft with a confirmation linking to the
task in the app. **Отмена** SHALL drop the draft. A draft SHALL be used at most once; a button
of a draft that is used, dropped, older than a day, or of another chat SHALL do nothing but say
the draft is no longer there. When the task cannot be created, the bot SHALL say so.

#### Scenario: Creating

- **WHEN** Анна presses **Создать** on a draft naming Бориса
- **THEN** the task appears on the board created by Анна, Борис is notified that he was named on it, and the bot's message links to the task

#### Scenario: Pressed twice

- **WHEN** Анна presses **Создать** twice on the same draft
- **THEN** one task is created and the second press says the draft is no longer there

#### Scenario: Cancelling

- **WHEN** Анна presses **Отмена**
- **THEN** no task is created and the bot's message says the draft was cancelled

#### Scenario: Access lost before confirming

- **WHEN** Анна is suspended after the draft was made and then presses **Создать**
- **THEN** no task is created and the bot says tasks are not available to her
