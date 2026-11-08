## Context

See proposal.md for the motivation and specs/site-traffic-sources/spec.md for the required behavior.

The `seo-search-console` change put a `seo` module in the API. A `SeoSite` holds an encrypted refresh token with the `webmasters.readonly` scope, and the module reaches Google sign-in through ports wired to the integrations module. Imports run in a worker with leases and a morning schedule. In the web, `widgets/seo-overview` holds the SEO tab and the site's panel lives in `features/seo-integration`.

Search Console cannot tell where a visit came from, so this change reads Google Analytics 4. Its Data API needs the `analytics.readonly` scope. The site's current token does not have it, so the member must consent once more.

## Goals / Non-Goals

**Goals:**
- Reuse the site's credential and the existing sign-in, so there is one Google login per site and one place to disconnect.
- Keep traffic data deletable on its own, without touching search figures.
- Let a missing or revoked Analytics access degrade only the traffic block.

**Non-Goals:**
- Yandex Metrika. It needs its own OAuth app and waits with the Yandex Direct integration.
- Conversions, revenue, engagement and page-level traffic.
- Our own tracking script on client sites.
- Attributing advertising spend to channels.

## Decisions

### One sign-in carries both scopes

Every Search Console sign-in asks for `webmasters.readonly` and `analytics.readonly` together. The same token then lists the sites and the GA4 properties, so connecting a site can choose both in one window and nothing is asked twice. Google's granular consent lets the member untick Analytics, so a missing grant is a normal case: listing properties for a token without the scope fails, and the choice list treats that failure as no properties. The Analytics grant is checked only through that listing, never assumed.

A third purpose, `SITE_ANALYTICS`, remains for a site that has no property or needs its token renewed. It is bound to an existing `SeoSite`, redirects with `analytics=<authorization>`, and on the callback replaces that site's refresh token in place, as a renewal does. A site renewed for Analytics is refused if the new sign-in does not reach the same Search Console property, which is the existing renewal rule. While a property is linked, the site's Войти заново action starts this sign-in, so a token that lost the Analytics scope is replaced by one that has it. Choosing the same property again keeps its data and refreshes only the last 3 days.

Alternative: store a second token for Analytics. That doubles the encryption, revoke and disconnect paths, and lets the two tokens drift apart. One token per site keeps the rule that disconnecting a site removes every credential for it.

Alternative: ask for Analytics only in a second step, which was the first version of this change. It kept the unverified-app screen away from members who do not want traffic, but it made every member who does want traffic sign in twice and pick twice.

### Properties are listed through the Admin API

The picker lists GA4 properties from `accountSummaries` of the Analytics Admin API, with the account and property names and ids. Universal Analytics properties do not appear there. The chosen property id is saved on the site as `analyticsPropertyId`. The Data API and the Admin API need to be enabled in the Google Cloud project.

### Data model

Two additions to `seo.prisma`:

| Table | Holds | Key |
|---|---|---|
| `SeoSite` | new columns `analyticsPropertyId`, `analyticsName`, `trafficStatus`, `trafficSuccessAt`, `trafficError` and lease fields | |
| `SeoTrafficDay` | site, date, channel group, source, medium, sessions | `(siteId, date, channel, source, medium)` |

One row per day, channel, source and medium is enough for every read: channels are a sum by channel group, the source list is a sum by source and medium, and the daily chart is a sum by date. Sessions is the only measure, so no second table is needed. Rows older than 90 days are deleted by the daily import.

### The import is its own unit after the search import

`runTrafficImport` fetches one `runReport` per 90-day window with the dimensions `date`, `sessionDefaultChannelGroup`, `sessionSource` and `sessionMedium`, the metric `sessions`, and a limit of 200 pairs per day, then writes in one transaction that replaces the re-read days. A failure writes nothing. It has its own status and lease, so a slow or failing Analytics call never delays or fails the search import. The worker polls it as a third loop on the morning schedule of the search import, for sites with a property.

Quota errors from Google map to the integrations' existing provider error codes, and the retry rules stay the same.

### Reads

Routes under `/api/projects/:id/seo`:
- `GET sites/:siteId/traffic?from&to` for channels with the previous period, sources and days;
- `POST sites/:siteId/analytics/authorize` to start the sign-in, manager only;
- `GET analytics-authorizations/:authorization/properties` for the picker, manager only, answering the site the sign-in was started for and its properties, because the redirect carries only the authorization;
- `PUT sites/:siteId/analytics` to link and `DELETE sites/:siteId/analytics` to unlink, manager only.

The channel list sums `SeoTrafficDay` by channel group for the period and for the previous period of the same length, in one query each. The source list sums by source and medium and keeps the top 100.

### Web

A `TrafficBlock` joins `widgets/seo-overview` below the search charts. It reuses `DayChart`, the share bars of the top lists and `Loader`. The link flow lives in `features/seo-integration`: a Подключить Google Analytics button that starts the sign-in, a picker dialog opened by the `analytics=<authorization>` redirect parameter, and an Отключить Google Analytics action. The button is rendered by the component that owns it and shown by a `canManage` prop. Polling of the site list already covers busy statuses, and now includes `trafficStatus`.

## Risks / Trade-offs

- [Google may require verification for `analytics.readonly`] → the scope is read-only and the consent screen is already in review for Search Console; plan the verification together.
- [Every new connection now shows Google's unverified-app screen until the Analytics scope is verified] → verification is requested together with the consent screen update, and test users can continue through Advanced meanwhile.
- [Analytics shows sampled or thresholded data for small properties] → show Analytics' numbers as they come, with no adjustment.
- [A property with no tag looks like a broken import] → the empty state names the likely cause.
- [Source and medium values are unbounded] → cap at 200 pairs per day on import and 100 on read.

## Migration Plan

1. Enable the Analytics Data API and Analytics Admin API, and add the scope to the consent screen.
2. Deploy the migration, which only adds columns and a table.
3. Existing sites show the prompt to link a property, which asks for one more sign-in because their tokens predate the Analytics scope. No data moves.

Rollback is to hide the block. The columns and the table stay unused, and no search figure depends on them.
