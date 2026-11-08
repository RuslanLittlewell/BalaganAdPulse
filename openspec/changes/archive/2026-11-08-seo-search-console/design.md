## Context

See proposal.md for the motivation and specs/ for the required behavior.

The integrations module already covers several pieces this change can reuse:
- **Google sign-in.**
  - `GoogleOAuth` with the `adwords` scope.
  - The `GoogleAuthorization` table, which binds a pending sign-in to a project, a member and optionally a connection being renewed.
  - One callback route that redirects to `/projects/:id?google=<authorization>`.
- **Credential storage.** Credentials are encrypted with `credential-cipher`.
- **Import machinery.** Imports run in a worker with leases, retries and a morning schedule.

The project page builds its source tabs from integrations, imported campaigns and KPI accounts. A chosen tab switches the summary tiles above and the campaign table below. The web already has `DailyChart`, `Sparkline`, `MetricCard`, `SidePanel` and the segmented control. The API reaches another module only through that module's public `index.ts`, which an architecture test enforces.

## Goals / Non-Goals

**Goals:**
- Reuse the Google sign-in and import patterns, so a site connection behaves like a Google Ads connection wherever the specs say so.
- Keep SEO data apart from advertising data, so currency rules, KPI accounts, summary tiles per account and campaign imports never see a site.
- Fetch client pages without opening a path to our own network.

**Non-Goals:**
- Yandex.Webmaster, Bing Webmaster and other search consoles.
- Our own measurement script on client sites, and Chrome UX Report data per page.
- Rendering JavaScript. The check reads the HTML the server sends, as a crawler's first pass does.
- SEO in monthly reports, KPI targets on SEO figures, and alerts on drops. These can follow once the data exists.
- Getting past bot protection. A site that answers our checker with 403 or a challenge is reported as such.

## Decisions

### A separate `seo` module, with Google sign-in shared through integrations

The site connection, its imports, the page check and the routes live in a new `apps/api/src/modules/seo`. It is not a fourth provider in `ProjectIntegration`. That table carries a required currency and timezone, Meta lead polling fields, and an import worker that feeds campaigns. Each of those would need an exception for sites.

Sign-in stays in integrations and becomes purpose-aware:
- `GoogleAuthorization` gains `purpose` (`ADS` or `SEARCH_CONSOLE`, default `ADS`).
- `GoogleOAuth.authorizeUrl` takes the scope for the purpose, and Search Console uses `https://www.googleapis.com/auth/webmasters.readonly`.
- The callback redirects with `google=<id>` for Ads and `searchConsole=<id>` for Search Console.

The seo module declares ports for what it needs from sign-in: opening, reading and closing an authorization, the consent address, refreshing a token, and the cipher. Composition wires the integrations module's implementations into them, as it already wires the integrations module itself. The two modules never import each other. The alternative was a copy of the OAuth client in the seo module. A copy would split the per-project sign-in rules and the callback route, which Google allows only once per redirect URI we register.

### Data model

New Prisma models live in `prisma/models/seo.prisma`. All of them belong to `SeoSite` and are deleted with it.

| Model | Holds | Key |
|---|---|---|
| `SeoSite` (`seo_site`) | project, Search Console property (`sc-domain:site.ru` or `https://site.ru/`), resolved origin, encrypted refresh token, import state and lease fields, when vitals were last read, page check state and lease fields | unique `(projectId, siteUrl)` |
| `SeoDay` | date, clicks, impressions, position (Decimal) | `(siteId, date)` |
| `SeoQueryDay`, `SeoPageDay` | date, query or page, clicks, impressions, position | `(siteId, date, query)` / `(siteId, date, page)` |
| `SeoVital` | the current reading: device, metric, collection period end, p75 (Decimal), good, needs-improvement and poor shares (Decimal) | `(siteId, device, metric)` |
| `SeoVitalWeek` | the weekly history: device, metric, collection period end, p75 (Decimal) | `(siteId, device, metric, periodEnd)` |
| `SeoLab` | device, measured at, score, LCP, CLS, TBT, FCP, Speed Index | `(siteId, device)` |
| `SeoAudit` | the latest finished check: finished at, counts of checked and not checked pages | one per site |
| `SeoAuditPage` | address, status, final address, content type, response time, collected data as JSON, problem kinds, whether in a sitemap, whether it had impressions | `(auditId, url)` |

Positions are stored as Google returns them, per day. The average for a period is `Σ(position × impressions) / Σ impressions`, computed in the query.

Each import replaces a site's current readings, so a device that lost its field data shows none. The weekly history accumulates, with each week replaced when Google publishes it again. `vitalsReadAt` tells "not read yet" apart from "too few visits".

The problem kind is a closed list in the domain layer, and severity derives from it:
- errors: `HTTP_ERROR`, `UNREACHABLE`, `ROBOTS_BLOCKED`, `NOINDEX`, `TITLE_MISSING`, `JSON_LD_INVALID`;
- warnings: `TITLE_LONG`, `TITLE_DUPLICATE`, `DESCRIPTION_MISSING`, `DESCRIPTION_LONG`, `DESCRIPTION_DUPLICATE`, `H1_MISSING`, `H1_MULTIPLE`, `CANONICAL_ELSEWHERE`, `SITEMAP_REDIRECT`, `JSON_LD_UNTYPED`.

A new check builds its pages in memory and then swaps the `SeoAudit` row in one transaction. The previous results therefore stay readable until the swap, and a failed check leaves them alone.

### Talking to Google

- **Sites.** `GET webmasters/v3/sites` lists the properties. Entries with `siteUnverifiedUser` are dropped.
- **Daily totals.** `searchAnalytics/query` with `dimensions: ["date"]` and `type: "web"` returns final data. The first import asks for 16 months and later imports for 10 days, about 490 rows per site at most.
- **Queries and pages.** One request per day and dimension, `dimensions: ["query"]` or `["page"]`, `rowLimit: 1000`. Google sorts the rows by clicks, so each day keeps its own top 1,000. The first import costs 180 requests and a daily import 20, far below the per-site quota. Rows older than 90 days are deleted after each import.
- **Sitemaps.** `sitemaps.list` adds the sitemaps submitted in Search Console to those the checker finds in robots.txt.
- **Chrome UX Report.**
  - `records:queryRecord` and `records:queryHistoryRecord` take the origin and one form factor per request: `PHONE`, then `DESKTOP`.
  - A 404 means too few visits and is stored as no data.
  - For a domain property the origin is where `https://domain/` settles after redirects, fetched through the safe fetcher below.
- **PageSpeed.** `pagespeedonline/v5/runPagespeed` runs with `strategy=mobile` and `desktop` and `category=performance`. The timeout is 90 seconds, because a run takes tens of seconds.
- **Configuration.** CrUX and PageSpeed use a new `GOOGLE_API_KEY`. When it is missing, both are skipped and the API reports `vitalsConfigured: false`.

Each search import is one unit: totals, query rows, page rows and vitals are fetched first, then written in one transaction. A failed request writes nothing, which matches the advertising rule. PageSpeed belongs to the page check, not to the import, so its slowness never delays search figures.

### The page checker

- **Fetching.** It uses `node:https` and `node:http` with a custom `lookup`. The lookup resolves the host and rejects private, loopback, link-local, CGNAT, multicast and reserved IPv4 and IPv6 ranges at connect time, so a DNS answer cannot change between the check and the connection.
  - Redirects are followed by hand, at most five, each checked against the site's hosts and the same address rules.
  - No cookies or credentials are sent.
  - The body is read as a stream and cut at 2 MB.
  - The user agent is `AdPulseBot/1.0 (+https://<LANDING_HOST>)`.
- **The site's hosts.** For a URL-prefix property, its host. For a domain property, the domain and its subdomains.
- **robots.txt.** A small parser follows RFC 9309: groups by user agent, longest-match allow or disallow, and `*` and `$` patterns. It also collects the `Sitemap:` lines. Writing it ourselves costs less than adding a dependency for 100 lines of rules.
- **Sitemaps.**
  - `htmlparser2` in XML mode reads them, including gzip sitemaps through `node:zlib`.
  - Sitemap indexes are followed two levels deep, and at most 50 sitemap files are read.
- **Pages.** `htmlparser2` streams each page and collects:
  - the title, the meta description, keywords and robots tags;
  - the canonical link and the `og:*` properties;
  - the `lang` attribute and the text of each `h1`;
  - each `script[type=application/ld+json]` block, with `JSON.parse` deciding whether it parses.

  `htmlparser2` is MIT licensed and small. `jsdom` is heavier and slower for 500 pages.
- **Analysis.** Problems are found by a pure domain function over the whole set of collected pages. Duplicates need the whole set, and the function is easy to unit test without the network.
- **Pace.** Pages are fetched one at a time per site with a one-second gap. The worker runs at most two checks at once across all sites. A check stops fetching after 45 minutes and counts the remaining pages as not checked, so a slow site cannot hold a lane for hours.
- **robots.txt failures.** A 4xx robots.txt allows everything, as RFC 9309 says. A 5xx or unreachable robots.txt makes the rules unknown, so the check fails with `ROBOTS` rather than guess, and is tried again the next day. Pages on another origin of a domain property whose robots.txt fails are recorded as unreachable.

### Worker and schedules

A `seo-worker` loop runs in the same process as the import worker and copies its lease and retry pattern. It has two job kinds per site, each with its own `next…At`, `queuedAt` and lease columns:
- the search import, due every morning through the shared `nextMorning`;
- the page check, due 7 days after the last one.

Refreshing a connection queues the search import. Проверить сейчас queues the page check, or returns the running one. A worker that dies during a check loses its lease, and the next worker starts the check over, so a partial check is never published.

A credential that Google rejects with `invalid_grant` moves the site to `SIGN_IN`. Search imports stop, while vitals and page checks go on because they need no sign-in. Signing in again with the same site's id renews the token in place. The renewing sign-in must reach the same property, or the renewal is refused.

### API

All routes sit under `/api/projects/:id/seo`.

Managing sites requires `update integration`:
- `POST authorize`;
- `GET authorizations/:authorization/sites`;
- `POST sites`;
- `POST sites/:siteId/sync`;
- `POST sites/:siteId/audit`;
- `DELETE sites/:siteId`.

Reading requires the project read access campaigns use:
- `GET sites`;
- `GET sites/:siteId/search?from&to`, which returns the tiles for the period and the previous one, the days, and the last day with data;
- `GET sites/:siteId/top?kind=query|page&from&to&limit`;
- `GET sites/:siteId/vitals?from&to`;
- `GET sites/:siteId/audit`, which returns the counts and kinds;
- `GET sites/:siteId/audit/pages?kind`;
- `GET sites/:siteId/audit/pages/:pageId?from&to`.

Unreachable projects and sites answer 404. The access policy needs no new resource. Connecting, renewing and disconnecting are written to the audit trail like integration changes, without the credential. Every route gets OpenAPI documentation like the existing ones.

### Web

| Layer | Holds |
|---|---|
| `entities/seo` | React Query hooks for the read routes |
| `features/seo-integration` | the Search Console provider tile, the sign-in start, the `searchConsole=` return handler, the site chooser (`SearchableSelect`), the connection card |
| `widgets/seo-overview` | the tiles, the daily charts, the vitals block, the two ranked lists, the page check block and the page side panel |

The connection card reuses the Google card's layout with a Search Console logo added to `ProviderLogo`.

On `ProjectPage`, connected sites join the sources map under `seo:<siteId>` with the label `SEO · host`. A domain property shows the domain without `sc-domain:`. The single-account rule counts only advertising sources.

When a site's tab is chosen, the page renders `SeoSummary` in place of `PerformanceSummary`, and `SeoOverview` in place of the KPI strip, the switch and the table. The tab choice is remembered by the existing source memory.

`DailyChart` draws spend and conversions only, so the SEO view has its own `DayChart` built on the same shared `linePath` and `areaPath` helpers. It takes any series, and draws position on an inverted axis. The tiles use `MetricCard`, the device switch uses `Tabs`, and the weekly history uses `Sparkline`. While an import or check is queued or running, the hooks poll, as the integration panels do.

## Risks / Trade-offs

- **[Sensitive scope]** `webmasters.readonly` is a sensitive scope. Until Google verifies the app for it, only test users can sign in, and refresh tokens in testing mode expire after seven days. → Add the scope to the consent screen and submit verification before release. Expired tokens land in `SIGN_IN` and ask for a new sign-in, so nothing breaks silently.
- **[Server-side request forgery]** The server fetches addresses that come from client sitemaps. → Address checks at connect time, host limits on every redirect, no credentials sent, and size and time caps. Tests cover private addresses, redirects to them and DNS answers that change.
- **[Bot protection and JavaScript sites]** Sites behind bot protection answer 403, and single-page apps may serve no title in their HTML. → The panel shows the status code and the raw facts. The view states that the check reads the HTML the server sends. We do not try to look like a browser.
- **[Storage growth]** Query and page rows can reach 90,000 each per site. → The 1,000 per day cap, the 90-day pruning and an index on `(siteId, date)`. 16 months of totals are about 490 rows.
- **[Long checks]** 500 pages at one per second take more than eight minutes. → Checks run in their own loop with a two-check limit. Search imports never wait behind them.
- **[Anonymised queries]** Search Console hides rare queries, so the top queries add up to fewer clicks than the totals. → The bars show each item's share of the period's total clicks, which stays honest when the list does not add up to 100%.

## Migration Plan

The migration only adds:
- the `seo_*` tables;
- a `purpose` column on `google_authorization` with the default `ADS`.

Existing rows keep their meaning, and all existing data survives.

Deploying needs three more steps:
- enable the Search Console API, Chrome UX Report API and PageSpeed Insights API in the Google Cloud project;
- add the scope to the OAuth consent screen;
- create an API key restricted to the last two APIs, and set it as `GOOGLE_API_KEY` in the production `.env` and in `docker-compose`.

Rolling back means dropping the `seo_*` tables and the column. The Google Ads sign-in is unaffected, because its rows keep `purpose = ADS`.
