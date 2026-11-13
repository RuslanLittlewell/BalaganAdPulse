## Context

A lead's place on the board is one value: a fixed stage (`NEW`, `QUALIFIED`, `TARGET`, `PROPOSAL`)
or the id of a custom column. It changes in four places: manual creation and moves in
`lead-use-cases.ts`, column deletion in the same file (leads go back to `NEW`), and Meta import in
`lead-intake.ts` (always `NEW`). No table keeps the history. Moves and creations are in
`audit_event` as JSON (`entity_type = 'lead'`, `changes.before.stage` / `changes.after.stage`);
imports are not audited.

A Meta lead form lead is a `lead` with `origin = 'META'` and a `meta_lead` row whose `external_id`
is Meta's lead ID. Its phone and email live on the linked `crm_person`. The lead's amount is
`lead.amount`.

The integrations module already has what a Meta sender needs: the AES credential cipher bound to
the project, the leased background worker pattern of the lead poll, and Graph API v22.0 calls.

Meta's Conversion Leads guide asks for `action_source: system_generated`,
`custom_data.event_source: crm` and `custom_data.lead_event_source`, treats the lead ID as the
strongest identifier, accepts `event_time` up to seven days old, and asks for every stage to be
sent as it changes, starting with the raw lead.

## Goals / Non-Goals

**Goals:**

- One stage history that both this change and `crm-conversion-report` read, so "reached an event"
  means the same thing in Meta and in our report.
- Board transactions stay as they are apart from one insert per stage change: no Meta logic and no
  extra queries inside the board lock.
- A send that cannot be lost by a crash and cannot be repeated by a retry.

**Non-Goals:**

- Creating datasets or custom conversions in Meta. The client creates the dataset and the token in
  Events Manager; custom conversions belong to `crm-conversion-report`.
- Sending leads that did not come from a Meta lead form, and sending names, cities or other
  answers from the form.
- Live updates of the panel over WebSocket.

## Decisions

- **Stage history in the leads module.** A table `lead_stage_change` (`id`, `org_id`,
  `project_id`, `lead_id` with cascade delete, `from_stage`, `to_stage`, `changed_at`,
  `processed_at`) holds every entry into a stage, as text in the board's own form: a fixed stage
  name or a column id. It does not copy the lead's campaign or ad: attribution is a property of
  the lead and can be linked after import, so readers join the lead. The four places that set a
  stage add one row in the same transaction. A move within the same stage adds none.
  Alternative considered: reading history from `audit_event` JSON. Rejected because imports are
  not audited, the JSON shape belongs to the audit log, and the report needs an index on
  project and time.

- **Conversion events in the leads module.** `crm_conversion_event` (`id`, `org_id`,
  `project_id`, `name`, `name_key` as the lower-cased name with a unique index per project,
  `stages text[]`, `carries_amount`, timestamps), listed by creation time. Events are a CRM
  concept: column deletion strips the column from `stages` in the same transaction, and the
  report reads them without Meta. The routes sit beside the board's other routes and need the
  `integration` permission, since setting them up is a media buyer's job. `name_key` replaces a
  functional unique index, which the Prisma schema cannot describe.

- **Reaching an event is computed from history.** A change reaches an event when its `to_stage`
  is in the event's current `stages` and no earlier change of the same lead entered any of those
  stages. One SQL query answers this for a batch of changes. The report will use the same rule
  over a period, so adding a stage to an event changes past figures there, and only future sends
  here.

- **A worker turns history into sends, outside the board transaction.** A new `conversions`
  module runs a worker every minute in two steps. First it takes up to 500 changes with
  `processed_at` null (`FOR UPDATE SKIP LOCKED`, so instances do not share rows), finds the
  events each one reaches, keeps those whose lead has a `meta_lead` row and whose project has a
  connected dataset, inserts sends with `ON CONFLICT DO NOTHING`, and sets `processed_at`, all in
  one transaction. Then it sends what is due. Alternative considered: queueing sends from the
  board use cases through a port. Rejected because it puts dataset and event lookups inside the
  board lock and spreads Meta concerns over four use cases. The cost is up to a minute of delay,
  well inside the five minutes the spec allows.

- **Sends table.** `meta_conversion_send` (`id`, `org_id`, `project_id`, `lead_id` with cascade
  delete, `event_id` set null on event delete, `event_name` copied, `reached_at`, `status`,
  `hold_until`, `attempts`, `next_attempt_at`, `last_error`, `value`, `currency`, `test`,
  `sent_at`, timestamps) with a unique index on `(lead_id, event_id)`. That index is what makes a
  lead send an event once, across retries, instances and reconnections. Statuses: `WAITING_AMOUNT`,
  `PENDING`, `SENT`, `FAILED`, `EXPIRED`. Rows hang off the project, not the dataset, so
  disconnecting keeps the record of what was sent. Deleting a lead removes its rows, which also
  removes the only place its name was shown next to a send.

- **Waiting for the amount without a hook on edits.** A send of an event that carries the amount
  starts as `WAITING_AMOUNT` with `hold_until = reached_at + 72 h` when the lead's amount is empty
  or zero. The due query treats it as due when the joined `lead.amount` is above zero or
  `hold_until` has passed. Lead edits need no change. The value is read when the event is sent.

- **The dataset table.** `meta_dataset` (`project_id` as key, `org_id`, `dataset_id`,
  `dataset_name`, `encrypted_token`, `test_event_code`, `currency`, `state` `ACTIVE` or
  `AUTH_REQUIRED`, `last_error`, `last_sent_at`, `revision`, `lease_owner`, `lease_until`,
  timestamps). The token is sealed with the existing AES cipher bound to the project id. Saving
  checks the pair with `GET /{dataset_id}?fields=id,name` and stores the name. A save without a
  token keeps the stored one, and is allowed only when the dataset ID does not change. `revision`
  changes on every save so that a worker holding an old lease cannot write over a replacement,
  as with `project_integration`.

- **Catch-up on connect.** When a project goes from no dataset to a dataset, the same transaction
  inserts sends for every event reached by a Meta form lead with `reached_at` in the last seven
  days, through the reaching query and `ON CONFLICT DO NOTHING`. Sent rows from an earlier
  connection block their own resend.

- **Sending.** The worker claims one dataset with due sends under a lease, as the lead poll does,
  and posts up to 100 events per request to `POST /v22.0/{dataset_id}/events`, looping up to
  ten requests per claim. Each event:

  ```json
  {
    "event_name": "Квал",
    "event_time": 1762934700,
    "action_source": "system_generated",
    "event_id": "<send id>",
    "user_data": { "lead_id": 1234567890123456, "ph": ["<sha256>"], "em": ["<sha256>"], "external_id": ["<sha256 of lead id>"] },
    "custom_data": { "event_source": "crm", "lead_event_source": "AdPulse", "value": 1200, "currency": "BYN" }
  }
  ```

  with `test_event_code` beside `data` when set. The event ID is the send's own id: there is one
  send per lead and event, and it stays the same across retries. Meta lead IDs have up to 17 digits, past the safe
  integer range of a JavaScript number, so the body is serialised with the digits written into
  the JSON as they are stored, never through `Number`. The phone hash is over
  `crm_person.phone_digits`; the email is trimmed and lower-cased; `external_id` is the hash of
  our lead id. Hashing happens at send time, so nothing personal is stored in the sends table.

- **Errors.** Meta's error codes 102 and 190, or HTTP 401, mark the dataset `AUTH_REQUIRED` and
  leave its sends pending; replacing the token makes them due at once. A 400 with error code 100
  on a batch of more than one resends each event alone, and an event still refused becomes
  `FAILED` with Meta's `error_user_msg` or `message`. Network failures, timeouts, 5xx, 429, the
  codes 1 and 2, and the rate-limit codes 4, 17, 32, 341 and 613 are temporary, and so is any code
  not listed here: `attempts`
  grows and `next_attempt_at` steps through 1, 5, 15 and 60 minutes, then every 3 hours. Every
  tick first marks unsent rows with `reached_at` older than seven days minus five minutes as
  `EXPIRED`, whatever the dataset's state. Logs carry the error code and the dataset id, never the
  request body.

- **API.** `GET`, `POST` `/api/crm/boards/:boardKey/conversion-events` and `PATCH`, `DELETE`
  `/api/crm/boards/:boardKey/conversion-events/:id` in the leads router, where the board key is
  the project id; `GET`, `PUT`, `DELETE` `/api/projects/:id/conversions-api` in the conversions
  router. `GET /conversions-api` returns the dataset (or null), the counts and the
  20 latest sends with the lead's name, so the panel needs one request. All of them require the
  `integration` permission and project reach, and are described in OpenAPI.

- **Counting days.** "Today" starts at local midnight in the time zone of the project's oldest
  Meta connection; 7 and 30 days are that many calendar days ending today, counted by `sent_at`.
  The report counts days in the account's time zone too, so the two agree.

- **Web.** A `conversions-api` feature renders the panel as a card in the project's «Интеграции»
  block after the connections, for members who may manage integrations, only when a Meta
  connection exists and the organization has the CRM module. The card shows the connection's
  state, the test mode notice and the counts; «Настроить» opens the dataset form with the event
  list and its editor (name, stages chosen from the board's columns as checkboxes, «С суммой»),
  and «Журнал» opens the latest sends. The summary refetches every 30 seconds. The copy suggests
  adding an event for «Новый», since Meta asks for the raw lead stage too. All copy lives in
  `ru.ts`.

## Risks / Trade-offs

- [Meta handles a Cyrillic `event_name` differently from what the docs suggest] → The first client
  is connected with a test event code and checked in Test Events before the code is removed; a
  refusal shows as «Не отправлено» with Meta's reason, so nothing fails silently.
- [The client's dataset is not set up for Conversion Leads, so Meta accepts events but does not
  optimise on them] → Out of our control; the panel hint names the Events Manager steps, and the
  dataset name shown after saving confirms the right dataset was used.
- [A sale entered days after the move is sent without a value] → The 72-hour hold covers the usual
  delay and still leaves four days for retries inside Meta's seven-day limit.
- [Leads reached through history backfilled from the audit log may differ from reality where a
  column was deleted, because those moves were not audited per lead] → Only the report's past
  figures are affected, and only for leads in deleted columns.
- [The worker scans history across all organizations every minute] → Unprocessed rows are found
  through an index on `processed_at`, which PostgreSQL uses for `IS NULL`, and backfilled rows are
  inserted as processed. A partial index was left out because the Prisma schema cannot describe
  one.

## Migration Plan

One migration creates `lead_stage_change`, `crm_conversion_event`, `meta_dataset` and
`meta_conversion_send`, then fills `lead_stage_change` from existing data with `processed_at` set,
so the worker does not send history:

1. each lead's entry into its first stage at `lead.created_at`, taking the stage from its
   earliest `CREATE` audit event (`changes.after.stage`) or `NEW` when there is none;
2. each `UPDATE` audit event of a lead whose `changes.before.stage` and `changes.after.stage`
   differ, at the event's `created_at`, for leads that still exist.

No existing table or column changes, and all existing data survives. Production applies the
migration as its own step before the new version starts, as usual. Rolling back means deploying
the previous version and dropping the four tables; nothing else depends on them.

## Open Questions

- Which error codes Meta returns for a dataset the token cannot reach, besides 190, will be
  confirmed on a real dataset. Until then they count as temporary and the events expire after
  seven days with the last error shown.
