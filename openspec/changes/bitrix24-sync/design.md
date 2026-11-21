## Context

The CRM has leads on per-project boards, people and companies that belong to a client, and, from `crm-lead-tasks-and-notes`, tasks bound to a lead and lead notes. Existing integrations (Meta, Google, Search Console) live at project level with a leased worker and an AES-GCM token cipher. Bitrix24 exposes a REST API behind a per-user inbound webhook address and delivers events to an outbound webhook with an application token. See proposal.md for the scope.

## Goals / Non-Goals

**Goals:**
- Both directions sync for leads, contacts, companies, notes, lead tasks and their comments.
- A failed or slow portal never loses an AdPulse change or blocks a member.
- The sync cannot loop and cannot be triggered by someone who does not hold the token.

**Non-Goals:**
- Bitrix24 deals, smart processes and custom fields. Leads only, with the fields named in the spec.
- Matching existing records by phone or email. Linking happens when a record is first synced.
- The Bitrix24 OAuth application and the marketplace listing.
- Deleting across systems.

## Decisions

**A `bitrix24` module with its own tables.** `Bitrix24Connection` (organization, portal host, sealed inbound address, token hash, webhook key, status, enabled, inbound project, last error, lease), `Bitrix24StageLink` (stage or board column to status id), `Bitrix24Link` (kind, local id, remote id, remote modified time, local synced time, dropped), `Bitrix24Inbox` (events waiting to be applied), `Bitrix24Problem` (skipped and failed changes with their reason) and `Bitrix24Run` (upload or download, counts, cursor, state). Every table hangs off the connection, which hangs off the organization, so deleting either removes the rest. The leads and tasks modules do not import it and are not changed. Alternative: call the Bitrix24 client from the use cases. Rejected because a portal outage would then break lead editing.

**Changes are found by scanning, not by an outbox.** The first plan wrote an outbox row in every write's transaction. Building it showed that this needs a hook in a dozen use cases across two modules, and still misses rows changed by imports and by SQL. Instead, each pass of the worker asks, per kind, for the records whose `updated_at` (or `edited_at`, then `created_at`, for notes and comments) is later than their link's `local_synced_at`, and for unlinked records created after the portal was connected. The link stores the exact `updated_at` it last sent, so a record edited during a push is sent again on the next pass. A refused change records its `updated_at` as `failed_for`, and the scan skips the record until it changes again. Deleted records simply stop appearing, which is what «deleting does not propagate» asks. Notes and tasks are scanned only under a linked lead, comments only under a linked task. The connection row is leased per pass, the way the import worker leases integrations.

**Events carry ids; the system fetches the record.** The portal's outbound events name the entity and its id only. The webhook route stores a `Bitrix24Inbox` row and answers 202; a worker fetches the record with `crm.lead.get`, `crm.contact.get`, `crm.company.get`, `tasks.task.get` or the comment lists, then applies it. The worker writes the fetched record straight into the CRM tables through the module's own store, and announces the board change through the leads module's realtime event, so open boards refresh. Changes that come from Bitrix24 are not written to the audit log, because the audit writer needs a member and these changes have none. Alternative: apply inside the request. Rejected because the portal expects a fast answer and retries on timeout.

**Public route: `POST /api/integrations/bitrix24/:key`.** The key is 32 random bytes, base64url, unique per connection. The body's application token is compared with the stored hash in constant time. Unknown key and wrong token share one 404. The route sits with the other open mounts, ahead of authentication, with its own rate limit.

**Last change wins by timestamps.** The record link keeps the remote modified time of the last applied or written state and the local synced time. An event applies when the remote `DATE_MODIFY` is later than the stored remote time and later than the local update time of the record. A local change is sent unless the remote time is later than the local one. Applying a remote change records its new remote time first, so the portal's report of our own write is recognized and dropped. Clock skew between the systems is accepted. A lead or contact that Bitrix24 created before the portal was connected is not brought over by an event, only by a download, so connecting moves nothing.

**Stage mapping is explicit.** Statuses come from `crm.status.list` for the lead status entity. Four fixed stages plus per-board columns map to status ids in `Bitrix24StageLink`. Without a mapping the lead's stage and status stay as they are, and the settings list the gap. Alternative: auto-create statuses in Bitrix24. Rejected because it edits the portal's configuration without asking.

**People and companies follow their lead.** A Bitrix24 contact attached to a lead gets the lead's client. One attached to nothing gets the inbound project's client. `Company` and `Person` need a client, so without an inbound project unattached contacts are skipped and counted.

**Tasks bind through the lead.** A Bitrix24 task carries the CRM binding `L_<lead id>` in its CRM field. Only tasks bound to a linked lead sync. Assignees match by email between the Bitrix24 user and the membership's user; no match leaves the task unassigned. Completion maps to `tasks.task.complete` and `tasks.task.renew`. The AdPulse description is a rich-text document, so it is sent as plain text and a Bitrix24 description only fills an empty one. Notes map to `crm.timeline.comment` on the lead and task comments to `task.commentitem`, whose id is stored as `<task id>:<comment id>`. Authors without a counterpart are written into the text as «Имя: текст».

**Secrets and requests.** The inbound address is sealed with the existing AES-GCM cipher and never returned. Outgoing requests go through the SEO module's safe fetcher rules (https only, public hosts, no redirects into private ranges) and are paced to two requests per second per portal, with backoff on `QUERY_LIMIT_EXCEEDED` and 5xx. The method names, event names and field names used here come from the Bitrix24 REST documentation. Checked against the documentation so far: events carry only `data.FIELDS.ID` and an `auth.application_token`; `crm.lead.update` takes `id` and `fields`; `PHONE` and `EMAIL` are lists of `{VALUE, VALUE_TYPE}`; `crm.timeline.comment.add` takes `fields.ENTITY_ID`, `ENTITY_TYPE` and `COMMENT`. Still to check against a live portal in the first task: the lead, contact, company, task and comment event names, the shape of `tasks.task.get` and `task.commentitem.*`, and whether outbound webhooks send `FIELDS_AFTER` for task events.

**Permissions.** A new `bitrix24-connection` resource in the access matrix allows ADMIN only. Every endpoint answers other roles 403, and an organization without the CRM module 404.

**Trial.** The worker claims a connection with the live-organization filter from `trial-expiry-pauses-sync`, so neither sending nor applying happens for an expired trial; webhook events are still stored and wait.

**Web.** `WebsiteLeadsButton` becomes `IntegrationsButton` in `widgets/crm-nav`, which opens an `IntegrationsDialog` holding the shared `Tabs` component. The body of `WebsiteLeadsDialog` moves into a `WebsiteLeadsPanel` that the first tab renders, and the dialog shell, title and close handling move up to the new dialog. The second tab renders a `Bitrix24Panel` in `features/bitrix24`, built on the same pieces: sections with `h3` headings and hint lines, the `Snippet` with `CopyButton` for the webhook address, and the bordered confirmation block for switching off and removing. The Bitrix24 connection is per organization, so its tab does not wait for a selected board, while the web integration's tab does. The button shows when the member manages website keys or is an admin; the tab bar shows only when more than one tab is offered. The button uses the default `Button` variant at the `h-8` height, as «Добавить лид» does, so it takes the theme's primary colour in light and dark without new tokens. React Query hooks and dictionary keys in `ru.ts` and `en.ts`. Status refreshes by polling every 10 seconds while the dialog is open.

## Risks / Trade-offs

- A burst of events floods the inbox → the route only inserts and answers; the worker drains at the portal's rate.
- Clock skew makes the wrong side win → accepted for the first version; the timestamps used are the portal's own for remote and the database's for local.
- A record present on both sides is duplicated by the backfill → the confirmation says so, and nothing else matches by content.
- A revoked webhook silently drops changes → the connection turns `AUTH_REQUIRED`, the section says so, and the outbox keeps waiting.
- Loops from echoes → recorded remote times, covered by tests that replay the portal's report of our own write.
- Event and field names differ from what this design assumes → the first task checks them against a live portal before the rest is built.

## Migration Plan

Add the tables with one migration. Deploy the API, then the web app. No existing data changes and no organization is connected until an administrator saves a webhook. Rollback is the previous release; the tables can stay.

## Open Questions

- Which Bitrix24 edition the first customer runs, because the task and timeline methods differ slightly between cloud and on-premise. The first task answers it.
