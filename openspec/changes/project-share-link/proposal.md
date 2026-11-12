## Why

A media buyer wants to show a client how a project performs, but the only way to see the figures today is a membership in the organization. Clients without an account get screenshots, which go stale the next day and cannot be opened down to a campaign.

## What Changes

- A project can have one share link, `https://app.balagan.pro/share/<token>`. Anyone who opens it sees the project's metrics without signing in.
- The shared page shows what preview shows: the period controls, the summary tiles, a tab for every ad account and SEO site of the project, the running-only switch, the campaign KPI blocks and the campaign table, with the CRM stage columns when the organization has CRM. A visitor switches tabs, changes the period and opens a campaign with its ad sets, ads and creatives.
- The shared page changes nothing. It has no navigation, no tasks, no project switcher and no control that edits tiles, KPIs or SEO checks.
- The project header gets a «Поделиться» button beside «Превью». Only an ADMIN creates the link, copies it, replaces it with a new one, which stops the old one, and switches it off.
- The link belongs to the project, not to an integration. An account connected later appears on it, and removing or reconnecting an integration leaves it working.
- The API answers the shared page's reads under `/api/shared/:token` without a session. It serves a fixed list of GET requests, only for the shared project, and limits how often one address may call it.
- The shared page cannot be embedded in another site, and search engines are told not to index it.

## Capabilities

### New Capabilities

- `project-share-link`: the project's share link, the page it opens, what that page shows and refuses, and how the link is created, replaced and switched off.

### Modified Capabilities

- `access-control`: the shared permission matrix gains a `share-link` resource.
- `api-documentation`: the reads served through a share link join the operations that need no session.

## Impact

- API: a `ProjectShareLink` model and one Prisma migration; endpoints to read, issue and remove a project's link; a public mount at `/api/shared/:token` with a request allowlist, a rate limit and an actor that reaches one project; project reach that honours that actor; OpenAPI descriptions for both.
- `packages/access-policy`: the `share-link` resource.
- Web: a `/share/:token` route tree outside the signed-in area, with its own query cache and API base; the project overview and the campaign page rendered in shared mode; a share dialog and the «Поделиться» button; Russian copy in `ru.ts`.
- Existing data is untouched, and nothing breaks for members.
