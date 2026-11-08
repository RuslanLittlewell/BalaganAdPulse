# seo-site-integration Specification

## Purpose
Connect a project to its site in Google Search Console and keep the site's search figures, top queries and pages, and Core Web Vitals in the project, refreshed every day without anyone opening Google's tools.

## Requirements

### Requirement: A project connects a Search Console site through Google sign-in

An agency member whose role may manage integrations SHALL be able to connect a site to a reachable project in three steps:
1. sign in with Google on that project;
2. see the Search Console sites that sign-in reaches;
3. choose one of them.

The sign-in SHALL ask for read-only access to Search Console and to Google Analytics, and nothing else. Analytics access that the member does not grant SHALL NOT prevent connecting the site. It SHALL be separate from any Google Ads sign-in on the same project. A site the signed-in account has not verified SHALL NOT be offered. Each chosen site SHALL become its own connection. A project MAY connect several sites, but a site SHALL be connected to a project at most once; connecting it again SHALL be refused with 409.

Customers SHALL NOT manage integrations, even on projects they may edit. The credential obtained SHALL belong to that connection alone: signing in on one project SHALL give no access on another. The credential MUST be encrypted at rest. It MUST be left out of read responses, logs, audit events, redirects and browser storage.

The sign-in SHALL be completable only by the member who started it, for the project it was started for, and once. Unknown or unreachable projects SHALL answer 404. A site connection SHALL have no currency: connecting one SHALL NOT change the project's currency and SHALL NOT be refused over currency.

#### Scenario: Connect a site
- **WHEN** an authorized member signs in with Google on a project and chooses the site site.ru
- **THEN** the connection is saved, an initial import is queued, and no response contains a token

#### Scenario: Only verified sites are offered
- **WHEN** the signed-in account owns site.ru and has an unverified entry for shop.ru
- **THEN** site.ru is offered and shop.ru is not

#### Scenario: The same site twice
- **WHEN** a member connects a site the project is already connected to
- **THEN** the API responds 409 and the existing connection is unchanged

#### Scenario: Restricted access
- **WHEN** a member without the integration permission, including a client who may edit the project, tries to connect a site
- **THEN** the server returns 403 without credentials or configuration details

#### Scenario: A sign-in started by someone else
- **WHEN** a Google callback arrives for a Search Console sign-in another member started, or one already used
- **THEN** it is refused and nothing is saved

#### Scenario: A project billed in USD
- **WHEN** a member connects a site to a project whose figures are in USD
- **THEN** the site is connected and the project's currency stays USD

#### Scenario: Not configured
- **WHEN** the server has no Google OAuth client or secret and a member starts connecting a site
- **THEN** the API reports that Google is not configured, and other connections are unaffected

### Requirement: Search figures are imported every day

For each site connection the server SHALL import daily figures and keep them for the site's 16 months of history:
- clicks, impressions, CTR and average position for each day;
- the queries and the pages that had impressions on each day, up to 1,000 queries and 1,000 pages per day, ranked by clicks and then impressions, each with its clicks, impressions and average position.

The daily totals SHALL cover the 16 months Search Console keeps. The query and page rows SHALL cover the most recent 90 days.

The first import SHALL run when the site is connected. Afterwards an import SHALL run every morning on the schedule of the advertising imports, and whenever an authorized member refreshes the connection. Each import SHALL read the most recent 10 days again, so figures Google completes late replace the earlier ones. A day imported twice SHALL hold one set of figures, not two.

An import SHALL follow the advertising imports' rules for retries, one active import per connection and publication: an import that fails part-way SHALL publish nothing, and the previous figures SHALL stay readable. The average position of several days SHALL be the daily positions weighted by impressions. CTR SHALL be clicks divided by impressions.

#### Scenario: First import
- **WHEN** a site with a year of search history is connected
- **THEN** the project holds a year of daily figures and the query and page rows of the last 90 days

#### Scenario: Late figures
- **WHEN** Google reports 40 clicks for a day on Monday and 52 clicks for the same day on Wednesday
- **THEN** after Wednesday's import the day shows 52 clicks

#### Scenario: Incomplete provider response
- **WHEN** any request of an import fails or returns invalid data
- **THEN** nothing from that import is published and the previous figures remain readable

#### Scenario: Weighted position
- **WHEN** a site was at position 2 with 100 impressions on one day and at position 10 with 300 impressions on the next
- **THEN** the average position of the two days is 8

#### Scenario: Manual refresh
- **WHEN** an authorized member refreshes a site connection
- **THEN** an import is queued, the control shows activity, and the figures update when it completes

### Requirement: Core Web Vitals are read from the Chrome UX Report

Every day, with the search import, the server SHALL read the site's field data from the Chrome UX Report for phones and for desktops. The data SHALL cover the following metrics:
- LCP, INP and CLS;
- FCP and TTFB.

For each metric it SHALL keep the 75th percentile and the shares of good, needs-improvement and poor experiences. It SHALL also keep the weekly history Google publishes, so the site's vitals can be followed over time.

The data SHALL be read for the site's origin. For a site registered as a whole domain, the origin SHALL be the one the domain's home page settles on after redirects.

When Google has too few visits to report a metric or a device, that metric or device SHALL be stored as having no data, and the import SHALL NOT fail. When the server has no Google API key, no field data SHALL be read, the view SHALL say the vitals are not configured, and search figures SHALL keep importing.

#### Scenario: Field data
- **WHEN** a busy site is imported
- **THEN** the project holds the 75th percentile and the good, needs-improvement and poor shares of LCP, INP, CLS, FCP and TTFB for phones and for desktops

#### Scenario: Too few visits
- **WHEN** Google has no field data for a small site's desktop visits
- **THEN** the desktop vitals are stored as having no data, the phone vitals and search figures import as usual

#### Scenario: No API key
- **WHEN** the server has no Google API key
- **THEN** search figures import and the vitals are reported as not configured

### Requirement: The home page gets a lab measurement

With every page check, the server SHALL take a PageSpeed lab measurement of the site's home page, once as a phone and once as a desktop. It SHALL keep the following results with the time of the measurement:
- the performance score from 0 to 100;
- LCP, CLS, TBT, FCP and Speed Index.

A failed measurement SHALL keep the previous one and SHALL NOT fail the page check. Without a Google API key no measurement SHALL be taken.

#### Scenario: A weekly measurement
- **WHEN** the weekly page check of site.ru runs
- **THEN** the home page's phone and desktop measurements are replaced by new ones with their time

#### Scenario: PageSpeed is down
- **WHEN** PageSpeed fails during a page check
- **THEN** the page check completes and the previous measurement stays

### Requirement: A revoked Google sign-in asks for a new one

When Google rejects or revokes a site connection's credential, the connection SHALL do three things:
- keep its imported data;
- stop importing;
- ask the member in Russian to sign in again.

Signing in again SHALL resume imports on the same connection. Page checks and vitals SHALL keep running in the meantime, because they need no sign-in.

Disconnecting a site SHALL delete its credential and its imported search figures, vitals, measurements and page checks. It SHALL also remove the site's tab. In-flight work MUST NOT commit afterwards. Connecting the site again SHALL import its history anew.

#### Scenario: Access revoked in Google
- **WHEN** the owner of the Google sign-in removes the application's access
- **THEN** the next import marks the connection as needing sign-in and keeps the imported figures

#### Scenario: Signing in again
- **WHEN** a member signs in again on that connection
- **THEN** imports resume without a second connection being created

#### Scenario: Disconnecting
- **WHEN** a member disconnects a site while its import is running
- **THEN** the credential and the site's SEO data are deleted, the site's tab disappears, and the running import stores nothing

### Requirement: A site connection has its own panel

Each site connection SHALL have a panel among the project's integration panels for members who may manage integrations. The panel SHALL show:
- the site;
- the time of the last successful import;
- the time of the last page check;
- safe failure feedback in Russian;
- a refresh control;
- a disconnect control that asks for confirmation;
- when the sign-in is revoked, a control to sign in again.

#### Scenario: A failed import
- **WHEN** a site's import fails because Google is unavailable
- **THEN** its panel shows a Russian message without provider details, and the time of the last successful import

#### Scenario: Confirming a disconnect
- **WHEN** a member activates the disconnect control of a site
- **THEN** a confirmation asks before anything is deleted
