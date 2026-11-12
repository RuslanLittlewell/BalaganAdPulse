## Context

See proposal.md for why. The facts below shape how.

- Every API read takes an `ActorContext` (user, membership, organization, role) built by the `authentication` and `actor-resolution` mounts. Project reach is one Prisma filter, `reachableProjects` in `apps/api/src/shared/infrastructure/project-reach.ts`, which campaigns, ad sets, ads, creatives, KPIs, summary tiles, SEO and lead stage counts all go through.
- Metrics, SEO figures and stage counts are read from our database. Only the ad preview (`GET /api/ads/:id/preview`) and, when the stored creatives are outdated, the ad's creative list (`GET /api/ads/:id/creatives`) call Meta while the request runs.
- Routers are coarse. The leads router serves stage counts next to lead lists and the CRM contacts, so mounting a whole router for the shared page would expose personal data.
- Preview (`?preview=1`) already renders the block the link must show, through `ProjectOverview` and `CampaignPage` with `previewing` set. Those pages call entity API functions, which go through the single client in `apps/web/src/shared/lib/http.ts`.
- `protectiveHeaders` sets `X-Frame-Options: DENY`, `frame-ancestors 'none'` and `Referrer-Policy: strict-origin-when-cross-origin` on every response. The trial guard blocks only writes, and a suspended organization is refused when the actor is resolved.

## Goals / Non-Goals

**Goals:**
- Reuse the existing read use cases and the existing pages, so the shared page shows the same figures as preview and follows later changes to them.
- Make what a link can reach an explicit list that a test and the OpenAPI document read, rather than a property of how routers happen to be mounted.

**Non-Goals:**
- Embedding in other sites, links that expire on a date, passwords on links, view counts.
- Links to a client or to the dashboard. One link shows one project.
- Live updates over the realtime channel on the shared page. A visitor reloads to see fresh figures.

## Decisions

### One row per project, the token stored as issued

A new model `ProjectShareLink` holds `id`, `projectId` (unique, cascade on project delete), `token` (unique), `createdById` (the membership that issued it, set null on removal) and `createdAt`. The token is 32 random bytes in base64url. Issuing when a row exists replaces its token in place; switching off deletes the row.

The token is stored as issued so the dialog can show the address again whenever an admin opens it. Hashing it, as a password-reset token would be, means the address can be shown only once and has to be replaced to be copied again. Encrypting it adds nothing, because the token opens only figures that sit in the same database.

Management endpoints live in a new `share-links` module, mounted with the project routes:

- `GET /api/projects/:id/share-link` returns `{ token, createdAt }`, or `null` when the project has none, as the KPI reads do.
- `PUT /api/projects/:id/share-link` with `{ renew: boolean }` creates the link (201), returns the existing one, or replaces its token when `renew` is true. Each creation, replacement and removal writes one audit event on the project, which never carries the token, since guests and clients read the trail.
- `DELETE /api/projects/:id/share-link` switches it off.

They check `share-link` in the permission matrix, which only ADMIN passes, and the project's reach, so a project of another organization answers 404.

### A public mount with an allowlist, not public copies of each endpoint

`ROUTE_MOUNTS` gets `{ id: "shared", path: "/api/shared/:token" }` before `authentication`. Its handler runs, in order:

1. the per-address rate limit;
2. token resolution: unknown token, deleted project or suspended organization answer 404 `Shared link not found`;
3. the allowlist gate: the request must be a GET whose path matches an entry of `SHARED_READS`, otherwise 404 `Endpoint not found`;
4. the shared actor is set on `req.actor`;
5. the CRM module gate for the stage-count entry;
6. a sub-router that mounts the existing read routers at their usual relative paths.

`SHARED_READS` is one exported list of `{ method, path }`, covering the reads that `ProjectOverview` and `CampaignPage` make in preview:

- `GET /`, the mount itself, which resolves the link and returns the project and the modules the page may use;
- the project's summary, campaigns, KPIs and summary tiles;
- the CRM board stage counts of the project's board;
- the SEO sites and each site's traffic, search, top, vitals, audit, audit pages and audit page;
- a campaign, its daily series and ad sets, an ad set's ads, a creative's file and poster, an ad's preview and creatives.

Writing a public copy of each endpoint was the alternative. It would keep the actor model untouched, but it duplicates about twenty handlers and their schemas, and every later change to a read would need a second change in its copy, or the shared page would drift from preview.

### A shared actor that reaches one project

`ActorContext` gains an optional `sharedProjectId`. The shared actor has the project's organization, the role `GUEST`, empty `userId` and `membershipId`, and `sharedProjectId` set. `grantedProjects` returns `{ OR: [{ id: sharedProjectId }] }` for it and `reachableProjects` adds the organization, so every existing reach check confines it to the one project. The condition sits under `OR`, the key a member's grants already use, because callers spread the reach filter after their own `id` and a top-level `id` would replace theirs, and a campaign of another project answers 404 as it does for a member who lacks access.

`GUEST` already reads campaigns, KPIs, project summaries, leads and SEO and writes nothing. The allowlist keeps it away from the one extra resource a guest reads, project documents. A new `VIEWER` role was the alternative. A role enters the Prisma enum, the member screens and every `Record<Role, …>`, but nobody holds a membership as a viewer, so it would be a role in name only.

### Limits, indexing and framing

The shared mount uses `createRateLimit` keyed by address, 300 requests a minute, about thirty page loads. The ad preview and ad creatives entries share a second limit keyed by token, 30 a minute, because each of them may reach Meta under the integration's token: a preview always does, and a creative list does when the stored creatives are outdated. The limits live in memory per process, like the existing login limits.

Responses under `/api/shared` and the HTML served for `/share/*` carry `X-Robots-Tag: noindex, nofollow`, and the shared page's document adds the matching robots meta tag. `protectiveHeaders` stays as it is, which keeps the page out of frames and sends only our origin as the referrer to other sites.

### The web app runs the same pages under a share scope

`App` gets a `/share/:token/*` route before `/*`, outside `RequireAuth`. Its `ShareArea`:

- creates its own `QueryClient`, so a signed-in member's cache and the visitor's never mix;
- sets a share scope in `shared/lib`, which the HTTP client reads to prefix every path with `/shared/<token>` and to skip the token refresh and the login redirect;
- fetches `GET /api/shared/:token` and shows either the dead-link page or the project's name with `ProjectOverview`, or `CampaignPage` at `/share/:token/campaigns/:campaignId`;
- provides an auth context with no user, no role and the modules from that answer, so `useCan` answers false everywhere and `useModuleEnabled("CRM")` follows the organization.

Under the share scope `usePreviewMode` reports preview on, the selection hooks take the project id from the scope and the campaign id from the shared path, and the path builders produce `/share/<token>/…` addresses, keeping the period in the query string as preview does. Queries for data outside the allowlist (members, tasks, the project list, integrations) are disabled under the scope. The module set in that answer lists only the always-on modules and CRM, so the tasks query never starts.

Rendering a separate, simplified public page was the alternative. It would be smaller at first, but it would show different figures from preview as soon as either changes, which is the drift the allowlist decision avoids on the API side.

### OpenAPI

The shared operations are generated from `SHARED_READS` and the existing operation descriptions, with the path under `/api/shared/{token}`, no security scheme, and 404 and 429 added to their failures. The route-enumeration test reads the shared mount's routes from the same list, so the document and the gate cannot disagree.

## Risks / Trade-offs

- [A reused router gains a new GET route that the allowlist happens to match] → Allowlist entries are exact paths with named parameters, not prefixes, and a test sends every GET route of the mounted routers that is not on the list through a live link and expects 404.
- [Code that keys on `membershipId` or `userId` runs for the shared actor] → Only allowlisted GET reads ever see it. Their tests run under the shared actor, and a read that turns out to need a member is fixed or dropped from the list.
- [A link is forwarded further than intended] → It shows only one project and changes nothing. The dialog replaces or switches it off at once, and the address names the link, never the project.
- [A replaced or switched-off link still shows data in a tab that is already open] → Every later request answers 404, and the page switches to the dead-link state on the next fetch.
- [The in-memory limits reset on restart and are per process] → Production runs one API process. A shared store becomes necessary only when the API scales out.

## Migration Plan

1. Add `ProjectShareLink` to `apps/api/prisma/models/projects.prisma` and generate the migration `project_share_link`. It only creates a table, so all existing data survives and no project has a link until someone creates one.
2. Deploy the API and the web app together. Before any link exists the new routes answer 404 and nothing else changes.
3. Rollback: revert the release. The table can stay, and dropping it loses only the issued links.

No change to `deploy/nginx.conf` is needed, since `/share/*` and `/api/shared/*` reach the same Express process as the rest of the app.
