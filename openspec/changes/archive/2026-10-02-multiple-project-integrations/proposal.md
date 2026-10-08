## Why

An agency often runs one client's project through several Meta ad accounts, but a project
holds exactly one connection. The integration area also has no way to add other providers
the agency plans to support, and some accounts' leads must not land on the CRM board.

## What Changes

- **BREAKING** A project holds any number of integration connections; each Meta account at
  most once per project. All connections of a project bill in one currency.
- The integration API moves from the single `/projects/:id/integrations/meta` resource to a
  list `GET /projects/:id/integrations`, `POST /projects/:id/integrations/meta` to add, and
  `/projects/:id/integrations/:integrationId` to replace credentials, change settings,
  refresh or disconnect.
- Each connection has its own panel, status, refresh and disconnect. A dashed "+" beside the
  panels opens a provider window: Meta, Google, Yandex, TikTok, GPT — only Meta selectable.
- Each Meta connection gets a lead import switch, on by default. Off stops lead polling for
  that connection only.
- Imported campaigns remember the account they came from, so previews, creatives and lead
  sweeps use the right connection's credential.

## Capabilities

### New Capabilities

### Modified Capabilities
- `meta-project-integration`: several connections per project; the provider window.
- `meta-lead-import`: polling per connection, honouring the lead import switch.

## Impact

- Prisma: `project_integration` gets its own `id` primary key, a `provider`, a
  `leads_enabled` flag and a unique `(project_id, account_id)`; `campaign` gets a nullable
  `source_account_id`, back-filled from the existing connection.
- API: integration routes, use cases, repository, import and lead-poll jobs, ad locator.
- Web: the project page's integration area, the Meta panel, the provider window.
