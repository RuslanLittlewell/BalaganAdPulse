## Why

A media buyer optimises Meta lead form campaigns on form submissions, so Meta learns to find people
who fill in forms, not people who buy. The agency's CRM board already holds every lead from those
forms with its Meta lead ID, and the board shows how far each lead got. Sending those stage changes
back to Meta through the Conversions API lets campaigns optimise on qualified leads and sales, and
gives a record of how far each lead got that the next change will turn into report columns.

## What Changes

- The CRM board records every stage change of a lead: the stage it left, the stage it entered and
  when. The history the audit log already holds is copied in, so the record starts with the board's
  past, not empty.
- A media buyer defines a project's conversion events, such as «Квал», «Замер» and «Продажа». Each
  event names the board stages that count as reaching it, and an event can carry the lead's amount.
  A lead reaches an event the first time it enters any of the event's stages.
- A media buyer connects a Meta dataset to a project: its ID, a Conversions API access token
  created in the client's Events Manager, an optional test event code and the currency of lead
  amounts. The token is checked against Meta, stored encrypted and never returned.
- When a lead imported from a Meta lead form reaches an event, the server sends the event to the
  dataset within minutes: the Meta lead ID, the hashed phone, email and lead ID, the time of the
  stage change and, for an event carrying the amount, the amount and currency. An event that
  carries the amount waits up to three days for the lead's amount to be entered.
- Each lead sends each event once. Events older than Meta's seven-day limit are not sent and are
  marked as expired. Failed sends are retried, and lasting failures keep Meta's reason.
- Connecting a dataset sends the events that leads reached during the previous seven days.
- The project's «Интеграции» block gains a Conversions API panel with the dataset, the events and
  their stages, how many events were sent today and over the last 7 and 30 days, the latest sends,
  and what was not sent and why.
- Out of scope: leads that did not come from a Meta lead form, external CRMs (Bitrix24, amoCRM,
  incoming webhooks), TikTok, and showing events in the performance table. Report columns with
  both our and Meta's attribution are the next change, `crm-conversion-report`, which reads the
  stage history and the events this change introduces.

## Capabilities

### New Capabilities

- `crm-conversion-events`: the stage history of CRM leads, and a project's conversion events
  mapped to board stages, with the rule for when a lead reaches an event.
- `meta-conversions-api`: connecting a Meta dataset to a project, sending the events reached by
  Meta lead form leads, and the panel that shows what was sent and what failed.

### Modified Capabilities

None. Deleting a board column and moving leads keep their current behaviour; the new capabilities
state what they record and how an event follows a deleted column.

## Impact

- Prisma: new tables for the lead stage history, conversion events, the project's Meta dataset and
  the sends to Meta, with a migration that copies stage history from the audit log. Existing data
  survives.
- API: lead creation, import, moves, amount edits and column deletion record stage history and
  queue sends in the same transaction; new routes for the dataset, the events and the delivery
  summary under the integration permission; a background worker that sends due events to the
  Conversions API; OpenAPI.
- Web: the Conversions API panel in the «Интеграции» block, with its forms, delivery summary and
  Russian copy in `ru.ts`.
- External: the Meta Graph API `POST /{dataset_id}/events` and `GET /{dataset_id}` with a
  Conversions API token supplied per project. No new configuration on the server.
