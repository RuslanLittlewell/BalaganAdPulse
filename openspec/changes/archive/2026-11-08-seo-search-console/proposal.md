## Why

The agency also runs SEO for some clients, and the project page shows only advertising. Members check Google Search Console, PageSpeed and the site's pages by hand and in different tools. A project should show how its site does in Google search, how fast it is for real visitors, and what is wrong on its pages, next to the advertising it already shows.

## What Changes

- A project can connect a site from Google Search Console. A member signs in with Google on the project, with read access to Search Console only, and picks one of the sites that sign-in reaches. The sign-in follows the per-project rules of Google Ads: it belongs to that connection alone, its credential is encrypted, and only the member who started it can finish it.
- The server imports the site's search figures every day: clicks, impressions, CTR and average position by day, and the top queries and top pages.
- The server reads the site's Core Web Vitals from the Chrome UX Report every day: LCP, INP and CLS, plus FCP and TTFB, for phones and computers. Once a week it also takes a PageSpeed lab measurement of the home page. Both use one API key held by the server.
- Once a week, and on demand through Проверить сейчас, the server checks the site's pages: the pages listed in the site's sitemaps and the pages that had impressions in search, up to 500. For each page it collects the status code, title, meta description, meta keywords, H1, canonical, robots directives, Open Graph tags and JSON-LD. It marks problems such as a missing or long title, duplicate titles, invalid JSON-LD, noindex and a page in the sitemap that robots.txt blocks.
- The connected site gets its own tab, SEO · site, among the project's source tabs, as if it were another integration. The tab shows an SEO view with charts instead of tables:
  - tiles for the period;
  - search figures by day;
  - the lab measurement block;
  - top queries and top pages;
  - the page check, with problems grouped by kind and a panel per page.
- The window that adds an integration offers Google Search Console. The site's connection gets its own panel, with a refresh control, a sign-in-again state and a disconnect control.

## Capabilities

### New Capabilities

- `seo-site-integration`: connecting a Search Console site through Google sign-in, importing its daily search figures and top queries and pages, reading Core Web Vitals and the lab measurement, schedules, revoked sign-ins and disconnecting.
- `site-page-audit`: checking a site's pages: which pages are checked, how they are fetched safely, what is collected from each page, which problems are marked, the weekly schedule and the manual check.
- `seo-project-view`: what the SEO tab shows: tiles, charts, the lab measurement, top queries and pages, the page check and the page panel, and who sees it.

### Modified Capabilities

- `meta-project-integration`:
  - The add window lists Google Search Console as a selectable provider with its logo.
  - Its connection panel is titled Google Search Console.
  - Source tabs include one tab per connected site, which does not count as an advertising account when deciding what the summary shows.

## Impact

- **API.**
  - A new `seo` module with a Search Console connection model, daily search figures, top query and page rows, Core Web Vitals snapshots, lab measurements and page check results, plus Prisma migrations.
  - New routes under `/api/projects/:id/seo`.
  - The Google OAuth client is reused with a second scope, `webmasters.readonly`, and the existing callback.
  - A worker loop for the daily imports and the weekly page check reuses the lease and retry pattern of the integrations module.
- **Configuration.** A new server variable `GOOGLE_API_KEY` for the Chrome UX Report and PageSpeed Insights. Without it the vitals blocks say they are not configured, and search figures still import. The Google Cloud project needs the Search Console API, Chrome UX Report API and PageSpeed Insights API enabled. Its OAuth consent screen needs the new scope, which Google may verify again.
- **Dependencies.** `htmlparser2` (MIT) in the API, for reading page HTML and sitemap XML.
- **Web.**
  - The provider window and connection panels get a Search Console entry.
  - The project page gets the site tab.
  - New SEO widgets reuse the existing daily chart, metric cards, segmented control and side panel.
  - The Russian copy lives in `ru.ts`.
- **Outbound traffic.** The server now fetches pages from client sites. Fetches are limited to the connected site's hosts and refuse private and local addresses.
