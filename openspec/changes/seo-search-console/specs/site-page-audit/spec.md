## Purpose

Check the pages of a connected site the way a search engine reads them: collect each page's title, description, keywords, headings, canonical, robots directives, Open Graph tags and JSON-LD, and mark the problems that hurt indexing and snippets.

## ADDED Requirements

### Requirement: The pages to check are found from sitemaps and search

A page check SHALL gather the site's pages from three sources:
- the home page;
- every page listed in the site's sitemaps, following sitemap indexes, where the sitemaps are found through robots.txt, at /sitemap.xml and among the sitemaps submitted in Search Console;
- every page that had impressions in the last 28 days of imported search figures.

Only pages on the site's own hosts SHALL be kept. Addresses differing only by a fragment SHALL count as one page.

A check SHALL fetch at most 500 pages, in this order:
1. the home page;
2. pages by impressions in the last 28 days, most first;
3. the remaining sitemap pages in sitemap order.

The pages left over SHALL be counted and reported as not checked.

#### Scenario: Sitemap and search pages
- **WHEN** a site's sitemap lists /a and /b, and only /c had impressions in search
- **THEN** the check covers the home page, /a, /b and /c

#### Scenario: A large site
- **WHEN** a site lists 2,000 pages in its sitemaps
- **THEN** 500 pages are checked, the home page and the pages with the most impressions first, and 1,500 are reported as not checked

#### Scenario: A sitemap pointing elsewhere
- **WHEN** a sitemap lists a page on another domain
- **THEN** that page is not checked

### Requirement: Pages are fetched politely and safely

The checker SHALL identify itself with its own user agent and SHALL obey the site's robots.txt rules for that agent, or for all agents when it has none. A page robots.txt disallows SHALL NOT be fetched and SHALL be reported as blocked.

The checker SHALL respect the following limits:
- it SHALL fetch one page of a site at a time, at most one per second;
- it SHALL fetch only http and https addresses on the site's hosts;
- it SHALL follow at most 5 redirects;
- it SHALL wait at most 15 seconds for a page;
- it SHALL read at most 2 MB of a page.

It MUST refuse any address that resolves to a private, loopback, link-local or otherwise reserved network address, including an address reached through a redirect. A response that is not HTML SHALL be recorded with its status and content type only.

#### Scenario: A page closed by robots.txt
- **WHEN** robots.txt disallows /private/ for all agents and the sitemap lists /private/report
- **THEN** /private/report is not fetched and is reported as blocked by robots.txt

#### Scenario: A host resolving to a private address
- **WHEN** a sitemap page's host resolves to 10.0.0.5
- **THEN** the page is not fetched and is reported as unreachable

#### Scenario: A redirect off the site
- **WHEN** a page redirects to another domain
- **THEN** the redirect is not followed and the page is reported as redirecting there

### Requirement: Each page's SEO data is collected

For each fetched page the check SHALL keep the following:
- **Response:** the status code, the final address after redirects, the content type, the response time and the page language.
- **Text tags:** the title, meta description and meta keywords.
- **Indexing:** the robots directives from meta tags and from the X-Robots-Tag header, and the canonical address.
- **Content:** the text of every H1.
- **Open Graph:** the title, description, image, type and address.
- **JSON-LD:** every block, with its source, the types it declares and whether it parses.

Text SHALL be kept with whitespace collapsed, as the page states it.

#### Scenario: A product page
- **WHEN** a page has a title, a description, keywords, one H1, a canonical to itself and a JSON-LD block of type Product
- **THEN** the check keeps each of them, and the JSON-LD block is recorded as Product and parsed

### Requirement: Problems are marked

A check SHALL mark the problems below on each page. Each problem SHALL be either an error or a warning.

Errors:
- the page answers with a 4xx or 5xx status, or cannot be reached;
- a page listed in a sitemap is blocked by robots.txt;
- a page listed in a sitemap or with impressions carries noindex;
- the page has no title;
- a JSON-LD block does not parse.

Warnings:
- the title is longer than 60 characters;
- the title repeats the title of another checked page;
- the page has no meta description;
- the meta description is longer than 160 characters;
- the meta description repeats another checked page's description;
- the page has no H1;
- the page has more than one H1;
- the canonical points to another address;
- a page listed in a sitemap redirects;
- a JSON-LD block declares no type.

Repeats SHALL be counted only among pages that answered 200 and may be indexed. Meta keywords SHALL be shown but never marked.

#### Scenario: Duplicate titles
- **WHEN** /a and /b both answer 200 with the title Купить окна
- **THEN** both pages carry the warning about a repeated title

#### Scenario: Broken JSON-LD
- **WHEN** a page holds a JSON-LD block with a missing closing brace
- **THEN** the page carries the error that its JSON-LD does not parse

#### Scenario: A noindex page in the sitemap
- **WHEN** a sitemap page carries a robots meta tag with noindex
- **THEN** the page carries the noindex error

#### Scenario: A repeat on a redirecting page
- **WHEN** /old redirects to /new and both end on the same title
- **THEN** the title is not marked as repeated

### Requirement: Checks run weekly and on demand

Each site connection SHALL be checked once a week. A member who may manage integrations SHALL be able to start a check at once through Проверить сейчас. Starting a check while one runs SHALL join the running check rather than start a second.

A check's results SHALL replace the previous check's only when it finishes, so the previous results stay readable until then. A check SHALL spend at most 45 minutes fetching pages; the pages left when that time runs out SHALL be counted as not checked.

The check SHALL fail in two cases:
- it reaches neither robots.txt nor the home page of the site;
- robots.txt answers with a server error, because the site's rules are then unknown.

A failed check SHALL keep the previous results, show the reason in Russian, and be tried again the next day.

#### Scenario: Checking now
- **WHEN** an authorized member presses Проверить сейчас
- **THEN** a check starts, the control shows activity, and the new results appear when it finishes

#### Scenario: A site that is down
- **WHEN** the site does not answer during a check
- **THEN** the check fails, the previous results stay, and the reason is shown

#### Scenario: robots.txt answers with a server error
- **WHEN** the site answers its robots.txt with 503 during a check
- **THEN** the check fails with that reason and the previous results stay

#### Scenario: A guest
- **WHEN** a guest opens a site's SEO view
- **THEN** no Проверить сейчас control is shown, and the API refuses a check started by the guest with 403
