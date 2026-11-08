## 1. Analytics sign-in

- [x] 1.1 Add the `SITE_ANALYTICS` purpose to `GoogleAuthorization` with a migration; make the authorize URL ask for `analytics.readonly` and `webmasters.readonly` with granted scopes included; redirect with `analytics=<authorization>`; bind the sign-in to an existing site
- [x] 1.2 On the callback, replace the site's encrypted refresh token in place and refuse a sign-in that does not reach the same Search Console property
- [x] 1.3 Tests: the scopes asked, the redirect parameter, another member's or a used sign-in refused, the same-property rule, Ads and Search Console sign-ins unchanged

## 2. Traffic model and import

- [x] 2.1 Add the `SeoSite` columns and `SeoTrafficDay` to `prisma/models/seo.prisma`, with the migration
- [x] 2.2 Add the GA4 client: properties from `accountSummaries`, `runReport` by date, channel group, source and medium, and errors mapped to the provider error codes
- [x] 2.3 Add `runTrafficImport`: a 90-day first load, a 3-day re-read, 200 pairs per day, one transaction, nothing published on failure, deletion of rows older than 90 days, its own status and lease; start it after the search import
- [x] 2.4 Tests: first import, a late day replacing the earlier figures, a failure publishing nothing, a revoked credential keeping data, the cap per day, a search import unaffected by a failing traffic import

## 3. Routes

- [x] 3.1 Add `GET analytics/properties`, `PUT analytics` and `DELETE analytics` for managers, with audit entries and OpenAPI; unlinking deletes the traffic rows only
- [x] 3.2 Add `GET traffic?from&to` with channels, the previous period, the top 100 sources and the days
- [x] 3.3 Tests: 403 for clients, 404 for unreachable sites, no token in any response, 409-free replacement of a linked property, shares and the previous period, an empty period, the not-connected answer

## 4. The traffic block in the web

- [x] 4.1 Add the types and hooks for the new routes to `entities/seo`, with polling while the traffic import runs
- [x] 4.2 Build `TrafficBlock`: channels with sessions, share bar and change, the scrollable source and medium list, the daily chart, the loader, the empty and not-connected states
- [x] 4.3 Add the Подключить Google Analytics and Отключить Google Analytics controls and the property picker to `features/seo-integration`, shown by `canManage`
- [x] 4.4 Add the Russian copy to `ru.ts`
- [x] 4.5 Tests: channels and shares, the loader while importing, the button for managers and its absence for others, the picker, the empty state

## 5. Choose the property when connecting the site

- [x] 5.1 Make every Search Console sign-in ask for `analytics.readonly` with `webmasters.readonly`
- [x] 5.2 Answer the Analytics properties beside the sites when a sign-in's sites are listed, as an empty list when Google refused them, and accept an optional property when connecting, refusing one the sign-in does not reach and saving the site and its property together
- [x] 5.3 Add the optional property choice with the Без Google Analytics default to the site connection window
- [x] 5.4 Tests: properties listed and left out, a property saved with the site, none chosen, a refused property saving nothing, the first traffic import queued for a new site with a property

## 6. Docs

- [x] 6.1 Document the two new APIs, the scope and the consent screen step in the README and the deployment notes
