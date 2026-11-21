## Why

Agencies that run their sales in Bitrix24 keep the same leads, contacts and tasks in two places and copy between them by hand. A lead that a media buyer qualifies in AdPulse never reaches the sales team, and a deal moved in Bitrix24 never reaches the campaign report. A two-way sync removes the copying and keeps both sides current.

## What Changes

- An organization administrator connects one Bitrix24 portal from an «Интеграции +» button in the CRM header, coloured like «Добавить лид», which opens one dialog with the tabs «Web интеграция» and «Битрикс24», with the portal's inbound webhook address and the application token of its outbound webhook.
- Leads sync both ways: created, edited, moved between stages, with their amount, source, tags and notes.
- Contacts and companies sync both ways and stay attached to their lead.
- Lead notes sync with the comments on the Bitrix24 lead. Tasks that belong to a lead sync with Bitrix24 tasks bound to that lead, together with their comments.
- Changes from AdPulse go to Bitrix24 through a queue that retries, and changes in Bitrix24 reach AdPulse through its outbound webhook. When both sides changed the same record, the later change wins.
- The administrator maps AdPulse stages to Bitrix24 lead statuses, chooses the project for leads that start in Bitrix24, and can run a one-time upload or download of existing records.
- Deleting a record on one side does not delete it on the other.
- An organization whose trial has ended stops syncing, like every other integration.

## Capabilities

### New Capabilities
- `bitrix24-integration`: the connection, the webhook endpoint, the mapping, and the two-way sync of leads, contacts, companies, notes, tasks and comments.

### Modified Capabilities

## Impact

- `apps/api`: a new `bitrix24` module with its own tables (connection, stage mapping, record links, outbox), a client for the Bitrix24 REST API, a public webhook route, and a worker that drains the outbox. The leads and tasks modules publish their changes to it.
- `apps/web`: the «Web интеграция» button becomes «Интеграции +», coloured like «Добавить лид», which opens a dialog with two tabs. The existing web integration dialog moves into the first tab unchanged, and the new «Битрикс24» tab, built like it, is visible to administrators.
- Depends on `crm-lead-tasks-and-notes`, which introduces lead tasks and lead notes. Task and note sync cannot ship before it.
- No change to the tariff catalogue.
