## 1. Purpose-aware Google sign-in

- [x] 1.1 Add `purpose` to `GoogleAuthorization` with the default `ADS` and a migration; make `GoogleOAuth.authorizeUrl` take the scope for the purpose; make the callback redirect with `google=` for Ads and `searchConsole=` for Search Console; keep Ads use cases off Search Console sign-ins
- [x] 1.2 Tests: an Ads sign-in unchanged end to end, a Search Console sign-in asking for `webmasters.readonly` and redirecting with `searchConsole=`, a callback for another member's or a used sign-in refused, Ads accounts not listed for a Search Console authorization

## 2. Site connections in the API

- [x] 2.1 Add `prisma/models/seo.prisma` with `SeoSite`, `SeoDay`, `SeoQueryDay`, `SeoPageDay`, `SeoVital`, `SeoLab`, `SeoAudit` and `SeoAuditPage`, the back-relation on `Project`, and the migration
- [x] 2.2 Scaffold `modules/seo` with a Search Console client: sites list without unverified entries, search analytics by date and by day for queries and pages, sitemaps list, and errors mapped to the integrations' provider error codes
- [x] 2.3 Add the connection use cases: start a sign-in, list the sites it reaches, connect with 409 for a repeated site, renew in place only for the same property, disconnect with deletion of the site's data, list sites for project readers; with audit entries and the routes under `/api/projects/:id/seo` documented in OpenAPI
- [x] 2.4 Tests: connecting, unverified sites hidden, 409, 403 for guests and clients, 404 for unreachable projects and sites, no token in any response, no currency change, not configured, renewing the same site and refusing another, disconnecting during an import

## 3. Search figures and vitals in the API

- [x] 3.1 Add the search import: 16 months of totals and 90 days of top queries and pages on the first run, 10 days afterwards, pruning rows past 90 days, all written in one transaction
- [x] 3.2 Add the Chrome UX Report client and the vitals import: origin resolution for domain properties, current values and weekly history per device, no data on 404, skipped without `GOOGLE_API_KEY`; add `GOOGLE_API_KEY` to the config and to `docker-compose`
- [x] 3.3 Add the `seo-worker` loop with leases, retries, the morning schedule and the `SIGN_IN` state on `invalid_grant`, started with the import worker; add `POST sites/:siteId/sync`
- [x] 3.4 Add the read routes `search`, `top` and `vitals`: tiles for the period and the previous one, impression-weighted position, the last day with data, top lists by clicks with the covered range, vitals with ratings by Google's thresholds
- [x] 3.5 Tests: first import and repeat import without duplicates, late figures replaced, a failed request publishing nothing, the weighted position, pruning, too few visits, no API key, a revoked sign-in keeping data and resuming after a new sign-in, the read routes with their periods and the 90-day note

## 4. Page check in the API

- [x] 4.1 Add the safe fetcher: the address check in `lookup` for private and reserved ranges, host limits, manual redirects up to five, the 15-second timeout, the 2 MB cap and the user agent
- [x] 4.2 Add the robots.txt parser following RFC 9309 and the sitemap reader with `htmlparser2` in XML mode, gzip, indexes two levels deep and the 50-file cap
- [x] 4.3 Add the page reader with `htmlparser2` collecting title, description, keywords, robots, canonical, `og:*`, `lang`, H1 and JSON-LD blocks
- [x] 4.4 Add the domain analysis that marks the problem kinds over a whole check, with duplicates among indexable 200 pages only
- [x] 4.5 Add the page check job: page selection and the 500 cap, one page per second, at most two checks at once, the PageSpeed lab measurement, publication by swapping the latest check, the weekly schedule, `POST sites/:siteId/audit` joining a running check, and the read routes `audit`, `audit/pages` and `audit/pages/:pageId`
- [x] 4.6 Tests: robots rules and wildcards, sitemap indexes and gzip, pages off the site dropped, private addresses and redirects to them refused, a redirect off the site not followed, size and time caps, each problem kind, duplicate rules, the 500 cap order, a failed check keeping the previous results, a failed PageSpeed not failing the check, a guest refused with 403

## 5. Connecting a site in the web

- [x] 5.1 Add `entities/seo` with the types and React Query hooks for the sites, search, top, vitals and audit routes, polling while an import or check runs
- [x] 5.2 Add the Search Console logo to `ProviderLogo` and the selectable Search Console tile to the provider window
- [x] 5.3 Add `features/seo-integration`: the sign-in start, the `searchConsole=` return handler, the site chooser, and the connection card titled Google Search Console with refresh, sign-in again, the last import and check times, safe errors and a confirmed disconnect
- [x] 5.4 Add the Russian copy to `ru.ts`
- [x] 5.5 Tests: the provider window with Search Console, choosing a site after sign-in, the card's states, refresh, disconnect confirmation, no controls without the integration permission

## 6. The SEO tab in the web

- [x] 6.1 Add site tabs `SEO · host` to the project's source tabs, remembered with the other sources and left out of the single-account rule; render the SEO summary and view when a site's tab is chosen
- [x] 6.2 Build `widgets/seo-overview`: the four tiles with change against the previous period, the daily charts with position on an inverted axis, and the latest-day note
- [x] 6.3 Build the vitals block with the Телефон and Компьютер switch, the five metrics with ratings, share bars and weekly charts, the pass or fail line, the too-few-visits and not-configured states, and the lab measurement
- [x] 6.4 Build the Запросы and Страницы ranked lists with share bars, independently scrollable lists of up to 100, and the 90-day note
- [x] 6.5 Build the page check block with counts, Проверить сейчас, problems grouped by kind and the page list per kind, and the page side panel with all collected data, JSON-LD sources and the page's search figures
- [x] 6.6 Add the Russian copy to `ru.ts`
- [x] 6.7 Tests: tabs with an account and a site, choosing the site and coming back, a client's person seeing the view without controls, tiles and the position improvement, the latest-day note, vitals ratings and pass or fail per device, too few visits, scrollable top lists, problem kinds in order, opening a page panel with its JSON-LD

## 7. Docs

- [x] 7.1 Describe the SEO integration in the README: the Google Cloud APIs to enable, the consent screen scope, `GOOGLE_API_KEY`, what is imported and when, and the checker's user agent and limits
