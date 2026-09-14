## Context

See proposal.md for motivation and the specs for required behaviour.

- `GraphProvider` issues GET requests against a fixed Graph origin with a bounded body, cursor pagination and error classification in which codes 10 and 200 count as a token failure.
- `ProjectIntegration` is one row per project holding the encrypted token, a credential `revision`, a single lease (`leaseOwner`, `leaseUntil`) and the daily schedule. `createImportWorker` claims one due row per minute and commits a snapshot only while it owns the lease and the revision is unchanged. A snapshot import may run for up to fifteen minutes.
- Ad-level daily metrics already store `conversions` from Meta's aggregate `lead` action, which includes Instant Form leads.
- The leads module creates leads only through member-driven use cases: board reach, a board lock taking an actor, contiguous positions, audit with a member actor and a `crm.changed` event published after commit. `Lead` has nullable `projectId` and `campaignId`.
- Meta exposes leads only on the ad and form nodes (`/{ad_id}/leads`, `/{form_id}/leads`), filterable by `time_created`. Documented lead fields are `id`, `created_time`, `ad_id`, `form_id` and `field_data`. There is no account-level edge.
- Web code follows Feature-Sliced Design: the lead dialog is a feature, creative preview and CRM board are widgets, and only pages compose widgets.

## Goals / Non-Goals

**Goals:**
- Import leads without new credentials, endpoints exposed to Meta or App-level subscriptions.
- Keep advertising import and lead polling isolated in scheduling, leases and failure states.
- Make lead creation atomic with coverage advance and idempotent across instances.

**Non-Goals:**
- Webhooks, OAuth onboarding and Page selection.
- Organic leads submitted outside ads, leads from other providers, and website pixel leads without contact data.
- Fetching form names or question texts, and letting members pick an ad for hand-made leads.
- Exporting leads back to Meta or to external CRMs.

## Decisions

### Read leads per ad, choosing ads from two sources

Poll `/{ad_id}/leads?fields=id,created_time,ad_id,form_id,field_data&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":<unix>}]` with cursor pagination.

- **Frequent poll, every 10 minutes.** List live ads through `act_{account}/ads` with `effective_status` `ACTIVE` and fields `id,name,adset{id,name},campaign{id,name,objective}`. Keep ads whose campaign objective is `OUTCOME_LEADS` or `LEAD_GENERATION`. Live listing catches ads launched after the morning import. The objective filter keeps request volume proportional to lead campaigns.
- **Daily sweep, after each successful advertising import.** Poll every imported ad of the project with `conversions > 0` in the last three imported days, over a window starting three days back. This catches leads from ads paused between polls and form leads on campaigns with other objectives, because Meta counts them in the `lead` action.

Names and parent identifiers for sweep ads come from the imported hierarchy. Names for live ads come from the listing.

Alternatives considered:
- Form edge. It needs a Page ID and form discovery from creatives, and it returns organic leads that have no ad.
- Every ad on every poll. The volume would exceed Ads Management limits on large accounts.
- Webhooks. Rejected with the user: they need an app subscription per Page, App Review and a public endpoint.

### Coverage is a single timestamp advanced only by a committed poll

`leadsCoveredUntil` stores the poll's start time `T`, captured before listing ads.

- The next frequent poll requests leads created after `leadsCoveredUntil − 10 minutes`. The overlap absorbs Meta's delayed availability and clock skew.
- When it is null, the poll requests from `T − 7 days`.
- The first poll requires `lastSuccessAt` to be set, so imported metrics and hierarchy exist.
- The sweep uses its own window and never moves `leadsCoveredUntil`.

Per-ad cursors were rejected: they grow with ads, and they break when ads come and go between polls.

### A ledger row per Meta lead makes creation idempotent

New table `meta_lead`:
- `org_id`, `external_id` (unique together), `lead_id` nullable with `SET NULL`, `imported_at`.

Inside the commit transaction, each lead first inserts its ledger row with `ON CONFLICT DO NOTHING`. Only inserted rows create CRM leads. The ledger survives lead deletion, so deleted leads are not re-imported. It is keyed by organization rather than project, so deleting and recreating a project does not duplicate leads that remain on the client board.

Personal data does not live in the ledger. It lives in `lead_meta_source`, which cascades with the lead.

### Source stored beside the lead, attribution on the lead

- `lead` gains `ad_id` (nullable FK to `ad`, `SET NULL`) and `origin` (`MANUAL` | `META`, default `MANUAL`).
- New table `lead_meta_source`, keyed by `lead_id` with cascade:
  - `account_id`, `form_id`;
  - campaign, ad set and ad external IDs and names;
  - `submitted_at`, `answers` JSON (`[{ question, values }]`), `answers_omitted`.

Attribution resolves by external ID inside the project:
- the campaign through `(channel META, external_id)` with the matching `project_id`;
- the ad through `ad → ad_set → campaign.project_id`.

After every successful snapshot commit, one statement links imported leads of that project whose `campaign_id` or `ad_id` is still null to matching entities. This is safe because members cannot change the attribution of imported leads.

The update use case refuses a changed `projectId` or `campaignId` when `origin = META` and accepts repeated values.

A JSON column on `lead` was rejected: it would bloat every board listing, and the source would not be separable from the hand-editable record.

### Separate lease and schedule for lead polling

`project_integration` gains:
- `leads_status` (`WAITING` | `OK` | `ACCESS_REQUIRED` | `ERROR`, default `WAITING`);
- `leads_covered_until`, `leads_last_success_at`, `leads_last_error`;
- `next_leads_at` (default now), `leads_queued_at`, `next_sweep_at`;
- `leads_lease_owner`, `leads_lease_until`.

A second worker, `createLeadPollWorker`, ticks every minute and claims a row where:
- `status <> 'AUTH_REQUIRED'` and `last_success_at IS NOT NULL`;
- the lead lease is free or expired;
- and `next_leads_at`, `leads_queued_at` or `next_sweep_at` is due.

It renews its own lease. It commits only while it owns that lease and `revision` is unchanged, the same guard as the snapshot import. Manual refresh sets `leads_queued_at`. A successful snapshot commit sets `next_sweep_at` to now.

Credential replacement for the same account keeps the lead columns; a different account resets them. Disconnect deletes the row, which invalidates any in-flight lease.

Sharing the snapshot lease was rejected: a fifteen-minute import would stall lead delivery.

### Lead intake enters through a port owned by integrations

The integrations application declares a `LeadInbox` port:
- `deliver(context, { orgId, clientId, projectId, leads })`;
- `linkAttribution(context, projectId)`.

Composition implements it with a leads-module intake service. The service:
- locks the board by `(orgId, clientId)` without an actor, through a new repository method beside the actor-based `lock`;
- appends positions in `NEW`;
- writes `lead`, `lead_meta_source` and the `meta_lead` link;
- returns the affected board so the worker publishes `crm.changed` after commit.

No audit event is written, because `audit_event` requires a member name, email and role. The source record carries the arrival instead.

A system membership was rejected because it would appear in member lists and permission checks.

### Provider mapping and error classification

`GraphProvider` gains `liveLeadAds(accountId)` and `leads(adId, since)`. Lead requests classify errors their own way:

| Meta response | Class | Effect |
| --- | --- | --- |
| Code 190 or 102 | `TOKEN` | Integration moves to `AUTH_REQUIRED` through the existing flow |
| Code 10 or 200–299 | New `ACCESS` | `leads_status = ACCESS_REQUIRED`, `next_leads_at = now + 1h`, advertising status untouched |
| 429, 5xx, transient, 4/17/32/613/80004 | `PROVIDER` | Retry at the next interval, honouring `Retry-After` |
| Payload fails validation | `INVALID_DATA` | `leads_status = ERROR`, retry at the next interval |

Field mapping:
- keys `full_name`, `first_name` + `last_name`, `phone_number` then `work_phone_number`, `email` then `work_email`, `company_name`;
- values validated with the lead Zod field schemas and dropped from contact fields on failure;
- answers kept by key in Meta's order, bounded to 100 answers and 10000 characters.

Logs carry only error class and HTTP/Graph codes.

### API and web

**Lead responses** gain:
- `origin`;
- `ad` (`{ id, name, externalId } | null`, when reachable);
- `metaSource` (`{ accountId, formId, campaign, adSet, ad, submittedAt, answers, answersOmitted } | null`).

**Integration read** gains `leads: { status, lastSuccessAt, lastError }`, still gated by project update permission. OpenAPI documents all of them.

**Web:**
- Change the values of `metric.conversions` and `metric.cpa` in `ru.ts`. Column ids stay, so saved visibility survives.
- The lead dialog renders a read-only source section, disables the project and campaign selects for `META` leads, and exposes `onPreviewCreative(ad)`.
- `CrmPage` composes `CreativePreviewDialog` from that callback, because FSD forbids features importing widgets.
- `LeadCard` shows `Meta · <campaign name>` when source text is absent.
- `MetaIntegration` shows lead status with Russian guidance on the required permissions.

## Risks / Trade-offs

- [Documented lead fields omit campaign and ad set] → Take them from the live ad listing or the imported hierarchy rather than from the lead.
- [Ads Management rate limits on accounts with many live lead ads] → Objective filter, Retry-After handling, bounded pages; move to Graph batch requests if production shows throttling.
- [Instant Form leads on non-lead objectives are only caught by the daily sweep] → Accepted delay; the sweep relies on the aggregate `lead` action already imported.
- [Token lacks page-level permissions or Leads Access Manager blocks the token owner] → Separate `ACCESS_REQUIRED` status with guidance; hourly retry recovers automatically.
- [Personal data in answers] → Stored only in `lead_meta_source` under board reach, deleted with the lead, never logged or sent over realtime.
- [Leads ledger grows without bound] → One narrow row per lead, indexed by unique key; volume matches CRM growth.
- [Eventual consistency in Meta's lead availability beyond the 10-minute overlap] → Daily sweep re-reads three days; ledger prevents duplicates.

## Migration Plan

1. Add a Prisma migration:
   - enum `lead_origin`;
   - columns `lead.origin` (default `MANUAL`) and `lead.ad_id` with FK `SET NULL` and an index;
   - tables `lead_meta_source` and `meta_lead`;
   - the lead-poll columns on `project_integration` with defaults and an index on `next_leads_at`.
   Everything is additive. Existing leads become `MANUAL` and keep all values; existing integrations start `WAITING` with null coverage, so their first poll imports seven days.
2. Apply the migration to a populated test database and verify that existing leads, integrations, campaigns and metrics survive unchanged.
3. Deploy the migration before the application, then start the lead worker beside the import worker in the server, stopping it before Prisma disconnect.
4. Rollback: stop the lead worker. The added columns and tables stay inert and existing reads ignore them. Keep the ledger so a redeploy does not re-import.

## Open Questions

- Whether to fetch form names and question texts through the form node when the token has Page access. This can be added later as a richer source display without changing polling.
