## Purpose

Show a connected site's search performance, Core Web Vitals and page problems on the project page as charts and blocks, in the site's own tab next to the advertising accounts.

## ADDED Requirements

### Requirement: Anyone who reads the project sees its sites

The SEO view of a connected site SHALL be readable by every member who may read the project. This includes guests granted the client and the client's own people, and it includes preview. The API SHALL answer 404 for an unknown or unreachable project or site.

Refreshing a connection and starting a page check SHALL require the permission to manage integrations.

#### Scenario: A client's person
- **WHEN** a person of the client opens a project with a connected site
- **THEN** the site's tab and its SEO view are shown, without refresh or check controls

#### Scenario: Another client's site
- **WHEN** a member asks the API for the SEO figures of a project they cannot reach
- **THEN** the API answers 404

### Requirement: The SEO view shows search figures for the period

The SEO view SHALL follow the project's period control. Its summary SHALL show four tiles for the period:
- Клики;
- Показы;
- CTR;
- Средняя позиция.

Each tile SHALL compare its value with the previous period of the same length. A lower position SHALL count as an improvement. These tiles SHALL NOT be configurable.

Below the summary, the view SHALL show charts by day for the period: clicks and impressions together, and the average position on an axis with 1 at the top. The view SHALL name the last day Search Console has figures for when the period reaches past it. Before the first import completes, the view SHALL say that the figures are being imported.

#### Scenario: Last 30 days
- **WHEN** a member chooses the last 30 days on the site's tab
- **THEN** the tiles show the clicks, impressions, CTR and average position of those days with their change against the 30 days before, and the charts show each day

#### Scenario: Recent days not yet in Search Console
- **WHEN** the period ends today and Search Console has figures up to three days ago
- **THEN** the charts end three days ago and the view names that day as the latest

#### Scenario: Position improves
- **WHEN** the average position goes from 12.4 to 9.1
- **THEN** the tile shows the change as an improvement

### Requirement: Core Web Vitals are shown by device

The view SHALL show the site's Core Web Vitals in a block with a Телефон and Компьютер switch. Телефон SHALL be chosen first.

LCP, INP and CLS SHALL be shown prominently, and FCP and TTFB beside them. Each metric SHALL show four things:
- its 75th percentile, in seconds or milliseconds, or without a unit for CLS;
- its rating against Google's thresholds, as Хорошо, Требует улучшения or Плохо, and as a color;
- a bar of the good, needs-improvement and poor shares;
- its weekly 75th percentile across the chosen period as a small chart.

| Metric | Хорошо up to | Плохо above |
|---|---|---|
| LCP | 2.5 s | 4 s |
| INP | 200 ms | 500 ms |
| CLS | 0.1 | 0.25 |
| FCP | 1.8 s | 3 s |
| TTFB | 0.8 s | 1.8 s |

The block SHALL say whether the site passes Core Web Vitals on the chosen device: it passes when LCP, INP and CLS are all good. For a device with no field data, the block SHALL say that Google has too few visits. When the vitals are not configured, the block SHALL say so.

The home page's lab measurement for the chosen device SHALL be shown in the same block and labelled as a lab measurement, with its time:
- the performance score, rated good from 90, needs improvement from 50 and poor below 50;
- LCP, CLS, TBT, FCP and Speed Index.

#### Scenario: A passing site
- **WHEN** a site's phone LCP is 2.1 s, INP 150 ms and CLS 0.05
- **THEN** the three show Хорошо, and the block says the site passes Core Web Vitals on phones

#### Scenario: A slow desktop
- **WHEN** the member switches to Компьютер and its LCP is 4.6 s
- **THEN** LCP shows Плохо and the block says the site does not pass on desktops

#### Scenario: A small site
- **WHEN** Google has no field data for the site
- **THEN** the block says Google has too few visits and still shows the lab measurement

### Requirement: Top queries and pages are shown as ranked lists

The view SHALL show a Запросы block and a Страницы block for the period. Each SHALL rank up to 100 items by clicks in a bounded, independently scrollable list without an expand button. Each item SHALL show its clicks, impressions, CTR and average position, with a bar of its share of the period's clicks.

A page that was checked SHALL open its page panel when chosen. When the period reaches back past the 90 days that queries and pages are kept, the blocks SHALL cover only the kept days and say so.

#### Scenario: The top queries
- **WHEN** a member opens the site's tab for the last 7 days
- **THEN** the Запросы block lists up to 100 queries, most clicks first, and the member can scroll within the block to see the remaining queries

#### Scenario: A long period
- **WHEN** the member chooses the last 6 months
- **THEN** the tiles and charts cover 6 months, and the Запросы and Страницы blocks cover the last 90 days and say so

### Requirement: The page check is shown as problems grouped by kind

The view SHALL show the latest page check in a block. The block SHALL show:
- the time of the check;
- the counts of pages checked, pages with errors, pages with warnings, and pages not checked;
- for members who may manage integrations, Проверить сейчас.

Below the counts, the problems SHALL be grouped by kind, errors first and then by the number of pages affected, each kind with its count. Choosing a kind SHALL list its pages. Before the first check completes, the block SHALL say that the pages are being checked.

#### Scenario: Problems by kind
- **WHEN** a check found 3 pages without a description and 1 page answering 404
- **THEN** the block lists the 404 kind with 1 page first and the missing description kind with 3 pages after it

#### Scenario: Pages of a kind
- **WHEN** the member chooses the missing description kind
- **THEN** the three pages are listed, and each can be opened

### Requirement: A page opens in a side panel

Choosing a checked page SHALL open a side panel on the right. The panel SHALL show:
- the page's address, with a link that opens it in a new tab;
- its status, and its final address if it redirected;
- its problems;
- the title and the meta description, each with its length;
- the meta keywords;
- each H1;
- the canonical and the robots directives;
- the Open Graph tags;
- each JSON-LD block, with its types, its formatted source and, when it does not parse, the reason;
- the page's clicks, impressions and average position in the period, when it had any.

Closing the panel SHALL return to the view where it was.

#### Scenario: Reading a page's JSON-LD
- **WHEN** a member opens a page whose JSON-LD declares Organization and BreadcrumbList
- **THEN** the panel shows both types and the formatted source of each block

#### Scenario: A page without search figures
- **WHEN** a member opens a sitemap page with no impressions in the period
- **THEN** the panel shows its SEO data and no search figures
