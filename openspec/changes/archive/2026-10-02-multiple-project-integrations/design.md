## Context

`project_integration` is keyed by `project_id`: the repository, the import job, the lead
poll job and the ad preview/creative lookups all find "the" connection by project. The
import upserts campaigns by `(channel, external_id)` and never deletes campaigns it did not
receive, so two accounts can feed one project without overwriting each other. Lead sweeps
and ad previews, however, pick the project's ads and the project's token, which is ambiguous
once a project has two accounts. The token is encrypted with the project id as associated
data.

## Goals / Non-Goals

**Goals:**
- Several Meta connections per project, each with its own jobs, status and lead switch.
- A provider window ready for future providers.

**Non-Goals:**
- Implementing Google, Yandex, TikTok or GPT integrations.
- Moving campaigns between connections, or one account feeding two projects (already a
  conflict).

## Decisions

- **Give connections their own `id`.** Migration adds `id UUID DEFAULT gen_random_uuid()`,
  swaps the primary key to it, adds `UNIQUE (project_id, account_id)` and an index on
  `project_id`. Existing rows keep their data and get ids. Every job and repository call
  that matched `projectId` matches `id`; leases and revisions stay per row.
- **`provider` column, `'META'` default.** A string rather than an enum, so adding a provider
  later needs no enum migration; the API validates it.
- **`leads_enabled BOOLEAN NOT NULL DEFAULT true`.** The lead-poll claim filters on it.
  Switching on sets `leads_queued_at = now` so the poll runs at once.
- **`campaign.source_account_id`.** Set by the import; back-filled from the project's
  connection for existing Meta campaigns. Lead sweeps filter ads by it, and ad previews and
  creatives pick the connection whose account matches the ad's campaign.
- **Keep the project id as the token's associated data.** A connection never changes
  project, so tokens stay decryptable without re-encryption.
- **Currency.** Connect refuses with `CURRENCY` when another connection of the project
  bills in a different currency; otherwise the rule from currency-from-integrations holds
  (adopt unless figures in another currency exist). The import's locked currency check
  stays the race guard.
- **Routes.** `GET /projects/:id/integrations` lists connections;
  `POST /projects/:id/integrations/meta` adds one (409 on a duplicate account);
  `PUT /projects/:id/integrations/:integrationId` replaces its credentials (same account);
  `PATCH …/:integrationId` sets `leadsEnabled`; `DELETE …/:integrationId` disconnects;
  `POST …/:integrationId/sync` refreshes. The old singular routes are removed; the web app is
  their only client.
- **Web.** The project page renders one `MetaIntegration` panel per connection and an
  `AddIntegration` dashed button that opens the provider window; choosing Meta opens the
  connection form in "new" mode. The lead switch uses the shared `Switch`.

## Risks / Trade-offs

- [Two accounts' campaigns in one list] → campaigns already carry their names; the source
  account is stored for later display if needed.
- [Back-fill misses Meta campaigns of a project whose connection was removed] → they keep a
  null source account: previews for them fall back to the project's only connection when
  there is exactly one, and are unavailable otherwise.

## Migration Plan

One Prisma migration as above; existing data survives. Rollback requires at most one
connection per project before restoring the old primary key.
