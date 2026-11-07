# SEO project integration

Open a project, press **Добавить интеграцию** and choose **Search Console**. The browser goes to
Google, where the member signs in with an account that has the site verified in Google Search
Console, and returns to the project. The project then offers the verified sites that sign-in
reaches. Choose one and press **Подключить**. The server queues the first import and the first
page check.

The site gets its own tab, **SEO · site**, next to the advertising accounts' tabs. Choosing it
shows the site's search tiles and SEO view in place of the campaign table. Everyone who reads the
project sees it, the client's people included. Only members who manage integrations connect,
refresh, check or disconnect a site.

The sign-in asks Google for read-only access to Search Console
(`https://www.googleapis.com/auth/webmasters.readonly`) and nothing else. It follows the rules of
the Google Ads sign-in:
- it belongs to the connection that made it;
- its refresh token is encrypted against the project with `INTEGRATION_ENCRYPTION_KEY`;
- it never reaches the browser.

When Google revokes the token, the site keeps its data and asks for a new sign-in under
**Настроить Search Console → Войти заново**.

## What is imported

Every morning, on the schedule of the advertising imports, and on **Обновить**, the server
reads:
- **Search figures.** Clicks, impressions and average position per day from Search Console's
  final web data. The first import reads 16 months, later ones the last 10 days, so late figures
  replace early ones.
- **Top queries and pages.** For each of the last 90 days, the 1,000 queries and the 1,000 pages
  with the most clicks. Older rows are deleted after each import.
- **Core Web Vitals.** The Chrome UX Report field data for the site's origin, for phones and for
  desktops: the 75th percentile and the good, needs-improvement and poor shares of LCP, INP, CLS,
  FCP and TTFB, and their weekly history. For a domain property the origin is where the domain's
  home page settles after redirects. A site with too few Chrome visits has no field data, and the
  view says so.

CTR is clicks divided by impressions. The average position of a period is weighted by
impressions. Ratings follow Google's thresholds: LCP up to 2.5 s is good and above 4 s poor,
INP 200 ms and 500 ms, CLS 0.1 and 0.25, FCP 1.8 s and 3 s, TTFB 0.8 s and 1.8 s.

## The page check

Once a week, and on **Проверить сейчас**, the server checks up to 500 of the site's pages:
1. the home page;
2. the pages with impressions in the last 28 days, most first;
3. the pages in the site's sitemaps, found through robots.txt, at `/sitemap.xml` and among the
   sitemaps submitted in Search Console.

From each page it keeps the following:
- the status code and the final address;
- the title, meta description and meta keywords;
- the robots directives from meta tags and the `X-Robots-Tag` header;
- the canonical, every H1, and the Open Graph tags;
- every JSON-LD block with its types.

It then marks problems on each page.

Errors:
- the page answers 4xx or 5xx, or does not answer;
- a sitemap page is closed by robots.txt;
- a sitemap page or a page with impressions carries noindex;
- the page has no title;
- a JSON-LD block does not parse.

Warnings:
- the title is longer than 60 characters, or repeats another page's title;
- the description is missing, longer than 160 characters, or repeats another page's description;
- the page has no H1, or more than one;
- the canonical points elsewhere;
- a sitemap page redirects;
- a JSON-LD block declares no type.

Repeats count only among pages that answered 200 and may be indexed. The check reads the HTML the
server sends and does not run JavaScript. With every check the server
also takes a PageSpeed lab measurement of the home page, as a phone and as a desktop.

The checker sends the user agent `AdPulseBot/1.0 (+https://<LANDING_HOST>)` and obeys the
site's robots.txt for that agent, or for all agents. It has these limits:
- one page of a site at a time, at most one a second, and at most two checks at once;
- 15 seconds and 2 MB per page;
- five redirects;
- 45 minutes per check, after which the remaining pages count as not checked.

It fetches only http and https addresses on the site's own hosts. It refuses any address that
resolves to a private, loopback, link-local or reserved network address, including one reached
through a redirect. A check fails, keeping the previous results, when neither robots.txt nor the
home page answers, or when robots.txt answers with a server error. A failed check is retried the
next day.

Disconnecting a site deletes its credential and all its SEO data. Connecting it again imports the
history anew.

## Server configuration

| Variable | Meaning |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` | The same OAuth client and callback as the Google Ads integration |
| `GOOGLE_API_KEY` | Optional. An API key for the Chrome UX Report API and the PageSpeed Insights API. Without it, search figures and page checks work, and the vitals and lab measurements say they are not configured |

Set these up in the Google Cloud project that owns the OAuth client:
1. Enable the Google Search Console API, the Chrome UX Report API and the PageSpeed Insights
   API.
2. Add the scope `https://www.googleapis.com/auth/webmasters.readonly` to the OAuth consent
   screen. Google treats it as a sensitive scope. Until the consent screen is verified for it,
   only test users can sign in and their refresh tokens expire after seven days.
3. Create an API key, restrict it to the Chrome UX Report API and the PageSpeed Insights API,
   and set it as `GOOGLE_API_KEY` in `/opt/adpulse/.env`.
