# seo-project-view Specification

## Purpose
Show a connected site's search performance, the home page lab measurement and page problems on the project page as charts and blocks, in the site's own tab next to the advertising accounts.

## Requirements

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

### Requirement: The home page lab measurement is shown by device

The view SHALL show the lab measurement of the home page in a block titled Лабораторный замер главной страницы, with a Телефон and Компьютер switch. Телефон SHALL be chosen first. The block SHALL replace the field Core Web Vitals block and SHALL show numbers only, with no bars or charts:
- the performance score;
- LCP, CLS, TBT, FCP and Speed Index;
- the time of the measurement.

Each figure SHALL be colored by its rating: good, needs improvement or poor. The score is rated good from 90, needs improvement from 50 and poor below 50. The other figures are rated by these limits:

| Figure | Хорошо up to | Плохо above |
|---|---|---|
| LCP | 2.5 s | 4 s |
| CLS | 0.1 | 0.25 |
| TBT | 200 ms | 600 ms |
| FCP | 1.8 s | 3 s |
| Speed Index | 3.4 s | 5.8 s |

#### Scenario: A measured home page
- **WHEN** the phone measurement has a score of 45, an LCP of 4.1 s and a CLS of 0.2
- **THEN** the block shows 45, 4,1 с and 0,20 beside their names, and the time of the measurement

#### Scenario: The other device
- **WHEN** the member switches to Компьютер
- **THEN** the block shows the desktop measurement

#### Scenario: Waiting for the first measurement
- **WHEN** a site was just connected and its import or page check is queued or running, and the chosen device has no measurement
- **THEN** the block shows a loader instead of the numbers

#### Scenario: No measurement and nothing running
- **WHEN** the chosen device has no measurement and no import or check is running
- **THEN** the block says there is no measurement yet

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
