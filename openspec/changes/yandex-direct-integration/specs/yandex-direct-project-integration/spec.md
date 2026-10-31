## Purpose

Connecting a project to a Yandex Direct account through Yandex sign-in, and importing the account's
campaigns, ad groups, ads and daily figures so they sit beside the project's Meta and Google ones.

## ADDED Requirements

### Requirement: A project connects a Yandex Direct account through Yandex sign-in

The system SHALL let an agency member whose role may manage integrations connect one or more
Yandex Direct accounts to a reachable project, each as its own connection, by signing in with a
Yandex ID on that project and choosing one of the accounts the sign-in reaches. A sign-in of an
advertiser SHALL reach that advertiser's own account; a sign-in of an agency SHALL reach each of
the agency's clients that is not archived, and requests for such an account SHALL be made on the
client's behalf. Customers SHALL NOT manage integrations, even on projects they may edit. The
credential obtained SHALL belong to that connection alone: signing in on one project SHALL give no
access on another, and no organization-wide Yandex authorization SHALL exist. The credential MUST
be encrypted at rest, and excluded from read responses, logs, audit events, redirects and browser
storage. Unknown or unreachable projects SHALL answer 404. An account SHALL be connected to a
project at most once, logins that Yandex treats as the same counting as one; connecting it again
SHALL be refused with 409. Every connection of a project SHALL bill in the same currency, and
connecting an account SHALL give the project the account's currency, under the same rules as for
Meta. An account kept in Yandex's conventional units rather than a currency SHALL NOT be
connectable. The sign-in SHALL be completable only by the member who started it, for the project
it was started for, and once.

#### Scenario: Connect an advertiser's account
- **WHEN** an authorized member signs in on a project with an advertiser's Yandex ID and chooses its account
- **THEN** the connection is saved and an initial import is queued
- **AND** no response contains a token

#### Scenario: An agency sign-in
- **WHEN** an authorized member signs in with an agency's Yandex ID that serves three active clients and one archived client
- **THEN** the three active clients are offered, and choosing one connects that client's account

#### Scenario: Each project signs in on its own
- **WHEN** a member has connected an account to one project and opens another
- **THEN** the other project shows no Yandex connection until the member signs in there

#### Scenario: A sign-in started by someone else
- **WHEN** a Yandex callback arrives for a sign-in another member started, or one already used
- **THEN** it is refused and nothing is saved

#### Scenario: Restricted access
- **WHEN** a member without the integration permission, including a client who may edit the project, tries to connect Yandex
- **THEN** the server returns 403 without credentials or configuration details

#### Scenario: The same account twice
- **WHEN** a member connects the account `ivan.petrov` to a project already connected to `Ivan-Petrov`
- **THEN** the API responds 409 and the existing connection is unchanged

#### Scenario: Figures in another currency
- **WHEN** an account billed in KZT is connected to a project holding figures imported in RUB
- **THEN** the connection is refused with a currency error and nothing changes

#### Scenario: Conventional units
- **WHEN** the chosen account is kept in Yandex's conventional units
- **THEN** the connection is refused with an explanation in Russian and nothing is saved

#### Scenario: Not configured
- **WHEN** the server has no Yandex OAuth client or secret and a member starts connecting Yandex
- **THEN** the API reports that Yandex is not configured, and Meta and Google connections are unaffected

### Requirement: Yandex Direct campaigns and daily figures are imported

The server SHALL import the connected account's campaigns, ad groups, ads and their daily spend,
impressions, clicks, conversions and revenue into the project, with the same hierarchy, schedule,
retries, one-active-import rule, last-30-days window, idempotence and no-partial-publication rule
as for Meta. Spend SHALL be the cost of clicks without VAT, converted from Direct's millionths of
the currency to a four-decimal amount without rounding error. Conversions and revenue SHALL be the
figures Direct reports from Yandex Metrica, and results SHALL equal conversions. A figure Direct
reports as empty SHALL be stored as zero. Reach, which Direct does not report by day for these
levels, SHALL be stored as zero. An archived campaign SHALL be imported only when it has figures in
the window. A report Direct is still preparing SHALL be waited for, and when it is not ready in
time the import SHALL be retried later without publishing anything. Running out of Direct's API
points SHALL postpone the import rather than mark the connection as failing. Imported data MUST
retain external identifiers. The import SHALL NOT read or copy creative files.

#### Scenario: Repeat import
- **WHEN** the same account is synchronized twice
- **THEN** existing imported entities and daily figures are updated without duplicates

#### Scenario: Incomplete provider response
- **WHEN** any required page or report fails or holds invalid data
- **THEN** no partial import is published and the previous successful data remains readable

#### Scenario: Spend without VAT in micros
- **WHEN** Direct reports a day's cost without VAT as 12345678 millionths
- **THEN** the project shows 12.3457 in the account's currency

#### Scenario: A day without conversions
- **WHEN** Direct reports a day's conversions and revenue as empty
- **THEN** that day shows 0 conversions, 0 results and 0 revenue

#### Scenario: Conversions as results
- **WHEN** Direct reports 7 conversions for a campaign on a day
- **THEN** that day shows 7 conversions and 7 results

#### Scenario: A report still being prepared
- **WHEN** Direct keeps answering that a report is being prepared past the time the import may wait
- **THEN** the import is retried later, nothing is published, and the previous data remains readable

#### Scenario: Out of points
- **WHEN** Direct refuses a request because the account has run out of API points
- **THEN** the import is postponed and the connection is not marked as needing attention

#### Scenario: An old archived campaign
- **WHEN** an account holds an archived campaign with no figures in the last 30 days
- **THEN** that campaign is not imported

#### Scenario: Currency mismatch
- **WHEN** the account's currency differs from the project's after figures exist
- **THEN** the import is refused and explained without converting amounts

### Requirement: A Yandex sign-in is kept alive, and a revoked one asks for a new one

A connection's Yandex credential SHALL be renewed by the server while the connection is in use, so
that a connection importing every day does not expire. When Yandex rejects or revokes the
credential, or refuses to renew it, the connection SHALL keep its imported data, stop importing,
and ask the member in Russian to sign in again; signing in again SHALL resume imports on the same
connection. Disconnecting SHALL delete the credential and stop future imports while retaining
imported data, and in-flight work MUST NOT commit afterwards.

#### Scenario: A credential due for renewal
- **WHEN** an import runs on a connection whose credential was obtained more than three months ago
- **THEN** the credential is renewed and stored before the figures are read

#### Scenario: Access revoked in Yandex
- **WHEN** the owner of the Yandex ID removes the application's access
- **THEN** the next import marks the connection as needing sign-in and keeps the imported data

#### Scenario: Signing in again
- **WHEN** a member signs in again on that connection
- **THEN** imports resume without a second connection being created

#### Scenario: Disconnecting
- **WHEN** a member disconnects a Yandex connection
- **THEN** its credential is deleted, its imports stop, and its campaigns remain

### Requirement: Yandex connections have their own panel and tab

Each Yandex connection SHALL have its own panel with a refresh control, the last successful
synchronization time and safe failure feedback, following the rules of a Meta panel, with all copy
in Russian. In the campaign tabs a Yandex connection SHALL be named `Яндекс · account`, where the
account is the advertiser's login, and SHALL list only the campaigns imported from it.

#### Scenario: A Google and a Yandex account
- **WHEN** a project has one Google and one Yandex connection
- **THEN** two tabs appear, Google · account and Яндекс · account, each listing its own campaigns

#### Scenario: Manual refresh
- **WHEN** an authorized member refreshes a Yandex connection
- **THEN** an import is queued, the control shows activity, and the figures update on completion
