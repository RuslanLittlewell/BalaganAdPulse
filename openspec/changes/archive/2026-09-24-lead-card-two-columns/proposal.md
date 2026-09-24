## Why

The lead dialog is a form: a few fields in a grid and a notes box, with nothing about what
happened to the lead or the documents that came with it. Sales staff work a lead as a record
they return to — a deal amount, what the prospect wants, how to reach them, what changed and
when, and the files exchanged — the way CRMs they already use lay it out.

## What Changes

- The lead dialog becomes a two-column card. The left column carries the stage at the top, the
  lead's name as the heading, then one labelled row per field and the description below them.
  The right column carries the tabs Активность and Файлы, plus Доп. информация — everything the integration
  delivered — for a lead that arrived through one. Creating a lead shows the left column alone.
- A lead gains a deal amount (shown as a plain number), a service, a Telegram, a messenger and
  tags. Tags are free words, suggested from the tags already used on
  the board.
- The field rows, in order: Сумма сделки, Ответственный, Компания, Метки, Услуга, Номер телефона,
  Telegram, Мессенджер, Email, Сайт, Источник. Notes are shown as the description. The card no
  longer offers a campaign choice; a campaign is set by the Meta import alone.
- A lead is still created from the card with a Создать button and edited with Сохранить.
- Files: members who may edit leads attach files to a saved lead, and everyone who reads the
  board lists and downloads them. Files are deleted with their lead.
- Activity: the card lists what happened to the lead — creation or import, field changes,
  stage moves and files added or removed — newest first, with who and when.
- Not in this change: Чат and Дела tabs, a contacts book, user-defined fields.

## Capabilities

### Modified Capabilities
- `lead-crm`: new lead fields; the lead dialog becomes a two-column card; files and activity
  on a lead; the integration's data moves to a Доп. информация tab; no campaign choice in the card.

## Impact

- **Database**: new nullable columns on `lead` (`amount`, `service`, `telegram`, `messenger`) and a `tags` text array defaulting to empty; a new `lead_file` table. No data is
  lost.
- **API** (`apps/api`): lead schemas, domain, repository, OpenAPI; new lead file and activity
  routes; file bytes in the existing S3 storage.
- **Web** (`apps/web`): `LeadFormDialog` replaced by a two-column card; lead entity types and
  queries for files and activity; `ru.ts`.
