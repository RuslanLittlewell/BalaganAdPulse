# meta-project-integration Specification

## Purpose

Connect a project's Meta advertising account so its campaign hierarchy and daily performance stay current through server-side imports.

## Requirements

### Requirement: Project connection and credential protection

The system SHALL let an agency member whose role may manage integrations connect one or more Meta accounts to a reachable project, each as its own connection, using a numeric Account ID with an optional `act_` prefix and an access token. Customers SHALL NOT manage integrations, even on projects they may edit. Credentials MUST be validated against Meta before replacing an existing connection, encrypted at rest, and excluded from read responses, logs, audit events and browser persistent storage. Connection reads SHALL require the integration permission and project reach. Unknown or unreachable projects SHALL return 404. An account SHALL be connected to a project at most once; connecting it again SHALL be refused with 409. Every connection of a project SHALL bill in the same currency: an account billed in another currency than an existing connection of the project SHALL be refused. Connecting an account SHALL give the project the account's currency. When the project already holds imported figures in a different currency, the connection SHALL be refused and the existing connection, currency and figures SHALL remain unchanged.

#### Scenario: Connect an account
- **WHEN** an authorized member submits a valid account and token
- **THEN** the connection is saved and an initial import is queued
- **AND** the response contains connection metadata but no token

#### Scenario: Reject invalid credentials
- **WHEN** Meta rejects replacement credentials
- **THEN** the existing connection remains unchanged and the user receives a safe error

#### Scenario: Restricted access
- **WHEN** a member without the integration permission, including a client who may edit the project, requests integration settings on a reachable project
- **THEN** the server returns 403 without credentials or configuration details

#### Scenario: The project takes the account's currency
- **WHEN** an account billed in USD is connected to a project with no figures
- **THEN** the project's currency becomes USD, whatever it was before

#### Scenario: Figures in another currency
- **WHEN** an account billed in USD is connected to a project holding figures imported in EUR
- **THEN** the connection is refused with a currency error and nothing changes

#### Scenario: A second account
- **WHEN** an authorized member connects a second Meta account billed in the project's currency
- **THEN** both connections are listed for the project and each imports its own campaigns into it

#### Scenario: The same account twice
- **WHEN** a member connects an account the project is already connected to
- **THEN** the API responds 409 and the existing connection is unchanged

#### Scenario: A second account in another currency
- **WHEN** a member connects an account billed in EUR to a project whose existing connection bills in USD
- **THEN** the connection is refused with a currency error and nothing changes

### Requirement: Idempotent advertising import

The server SHALL import campaigns, ad sets, ads and daily spend, impressions, reach, clicks, conversions and revenue into the connected project using all result pages. The initial and subsequent imports SHALL refresh the last 30 completed days in the account's timezone. Daily metrics SHALL be requested separately at each hierarchy level to preserve non-additive reach. Conversions SHALL use Meta's aggregate `lead` action, and revenue SHALL use aggregate `purchase` action values, with missing values zero and no summation of overlapping aliases. Imported data MUST retain external identifiers. Currency mismatch with the project SHALL prevent import and be explained without silently converting amounts. The import SHALL NOT read or copy creatives; those are fetched when an ad's preview is first opened.

#### Scenario: Repeat import
- **WHEN** the same account is synchronized twice
- **THEN** existing imported entities and daily metrics are updated without duplicates
- **AND** unrelated manual data and older history remain intact

#### Scenario: Incomplete provider response
- **WHEN** any required page fails or contains invalid data
- **THEN** no partial import is published and the previous successful data remains readable

#### Scenario: Existing external identifier belongs elsewhere
- **WHEN** a campaign external identifier already belongs to a different project
- **THEN** the import fails with a generic conflict without moving data or disclosing the other project

#### Scenario: Creatives stay out of the import
- **WHEN** an account is synchronized
- **THEN** no creative is read or copied, and the hierarchy and metrics are imported on their own

### Requirement: Manual refresh and visible status

The project interface SHALL provide Russian-language connection controls, a manual refresh action, last successful synchronization time and safe failure feedback. While an import is queued or running, the refresh control SHALL show activity and SHALL NOT accept another request. When nothing has failed, the panel SHALL show its heading but SHALL NOT show schedule text or a status line naming the synchronization state, account or currency; failure feedback SHALL appear only while the failure applies. Manual refresh SHALL require the integration permission and reach. Each connection SHALL have its own panel, refresh control and status. Concurrent requests SHALL result in at most one active import per connection. Successful completion SHALL refresh the displayed campaign data and summaries.

#### Scenario: Request refresh
- **WHEN** an authorized member clicks refresh on a connected project
- **THEN** a server-side import is queued and the refresh control shows activity, followed by updated data and a new last successful synchronization time or an actionable error

#### Scenario: Expired token
- **WHEN** Meta rejects a saved token during import
- **THEN** the interface requests token replacement while retaining previously imported data

#### Scenario: Healthy connection
- **WHEN** a member opens a project whose last import succeeded
- **THEN** the panel shows its heading and the last successful synchronization time, and no schedule, status, account or currency text

### Requirement: Daily morning synchronization

Connected projects SHALL synchronize every day at 08:00 Europe/Warsaw, respecting daylight saving time. Scheduling SHALL persist across process restarts, recover overdue work after downtime, and avoid concurrent imports across server instances. Transient failures SHALL receive bounded retries; credential failures SHALL wait for token replacement or explicit manual retry.

#### Scenario: Daily run after a restart
- **WHEN** the server starts after a connected project's daily run became due
- **THEN** it claims and processes the overdue import once, with the next daily run scheduled for the next local morning

#### Scenario: Competing workers
- **WHEN** two server instances see the same due project
- **THEN** only one owns the import and only its current ownership permits committing results

### Requirement: Disconnect without data loss

An authorized member SHALL be able to disconnect one account, delete its saved credential and stop its future imports while retaining previously imported data and leaving the project's other connections untouched. In-flight work MUST NOT commit after disconnect or credential replacement.

#### Scenario: Disconnect during import
- **WHEN** a member disconnects while a provider request is pending
- **THEN** its eventual response cannot update project data or recreate the connection

#### Scenario: Disconnecting one of two accounts
- **WHEN** a member disconnects one of a project's two connections
- **THEN** the other connection keeps importing, and the campaigns of both remain

### Requirement: Adding an integration offers the providers

Next to a project's integration panels, a member who may manage integrations SHALL find an
add control drawn with a dashed border. Choosing it SHALL open a window listing Meta,
Google, Yandex, TikTok and GPT. Only Meta SHALL be selectable; the others SHALL be shown as
not yet available. Choosing Meta SHALL open the Meta connection form for a new connection.
A member who may not manage integrations SHALL see no add control.

#### Scenario: Choosing a provider
- **WHEN** an authorized member activates the add control
- **THEN** a window lists Meta, Google, Yandex, TikTok and GPT, and only Meta can be chosen

#### Scenario: Connecting Meta from the window
- **WHEN** the member chooses Meta
- **THEN** an empty Meta connection form opens, and submitting it adds a new connection beside the existing ones

#### Scenario: No add control without the permission
- **WHEN** a member without the integration permission opens a project
- **THEN** no add control is shown

### Requirement: Campaigns are switched by connection in tabs

When a project has a connection or campaigns imported from an advertising account, tabs
SHALL appear above the campaign table, one per account,
named by its provider and account, and sized to their names rather than the table's width.
There SHALL be no tab combining the accounts. The first account's tab SHALL be chosen when
the project opens. With more than one account, a tab SHALL show only the campaigns imported
from its account and SHALL show no totals row, because reach cannot be added up across
campaigns. With a single account its one tab SHALL be shown, and the table SHALL list every
campaign with the project's totals. With no account, no tabs SHALL be shown.

#### Scenario: Two accounts
- **WHEN** a member opens a project whose campaigns come from two Meta accounts
- **THEN** tabs Meta · first account and Meta · second account appear above the table, the first is chosen, and no Все tab is offered

#### Scenario: Switching to an account
- **WHEN** the member chooses an account's tab
- **THEN** only that account's campaigns are listed, without a totals row

#### Scenario: One account
- **WHEN** a project has a single connection and its campaigns come from it
- **THEN** its one tab is shown, and the table lists every campaign with the project's totals

#### Scenario: No account
- **WHEN** a project has no connection and no imported campaigns
- **THEN** no tabs are shown
