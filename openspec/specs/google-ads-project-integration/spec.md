# google-ads-project-integration Specification

## Purpose
TBD - created by archiving change google-ads-integration. Update Purpose after archive.

## Requirements

### Requirement: A project connects a Google Ads account through Google sign-in

The system SHALL let an agency member whose role may manage integrations connect one or more
Google Ads accounts to a reachable project, each as its own connection, by signing in with
Google on that project and choosing one of the accounts the sign-in reaches. Customers SHALL
NOT manage integrations, even on projects they may edit. The credential obtained SHALL belong
to that connection alone: signing in on one project SHALL give no access on another, and no
organization-wide Google authorization SHALL exist. The credential MUST be encrypted at rest,
and excluded from read responses, logs, audit events, redirects and browser storage. Unknown or
unreachable projects SHALL answer 404. An account SHALL be connected to a project at most once;
connecting it again SHALL be refused with 409. Every connection of a project SHALL bill in the
same currency, and connecting an account SHALL give the project the account's currency, under
the same rules as for Meta. The sign-in SHALL be completable only by the member who started it,
for the project it was started for, and once. Requests to Google Ads SHALL NOT carry a developer
token: the access level is that of the Google Cloud project owning the OAuth client.

#### Scenario: Connect an account
- **WHEN** an authorized member signs in with Google on a project and chooses an account
- **THEN** the connection is saved and an initial import is queued
- **AND** no response contains a token

#### Scenario: Each project signs in on its own
- **WHEN** a member has connected an account to one project and opens another
- **THEN** the other project shows no Google connection until the member signs in there

#### Scenario: A sign-in started by someone else
- **WHEN** a Google callback arrives for a sign-in another member started, or one already used
- **THEN** it is refused and nothing is saved

#### Scenario: Restricted access
- **WHEN** a member without the integration permission, including a client who may edit the project, tries to connect Google
- **THEN** the server returns 403 without credentials or configuration details

#### Scenario: The same account twice
- **WHEN** a member connects an account the project is already connected to
- **THEN** the API responds 409 and the existing connection is unchanged

#### Scenario: Figures in another currency
- **WHEN** an account billed in USD is connected to a project holding figures imported in EUR
- **THEN** the connection is refused with a currency error and nothing changes

#### Scenario: Not configured
- **WHEN** the server has no Google OAuth client or secret and a member starts connecting Google
- **THEN** the API reports that Google is not configured and Meta connections are unaffected

#### Scenario: No developer token
- **WHEN** the server has a Google OAuth client and secret but no developer token
- **THEN** connecting Google works and no request to Google Ads carries a developer token

### Requirement: Google Ads campaigns and daily figures are imported

The server SHALL import the connected account's campaigns, ad groups, ads and their daily spend,
impressions, clicks, conversions and conversion value into the project, with the same hierarchy,
schedule, retries, one-active-import rule, last-30-days window, idempotence and
no-partial-publication rule as for Meta. Spend SHALL be converted from Google's millionths of
the currency to a four-decimal amount without rounding error. Conversions and revenue SHALL be
the account's own conversion figures. Reach, which Google does not report at every level, SHALL
be stored as zero where it is missing. Imported data MUST retain external identifiers. The
import SHALL NOT read or copy creative files.

#### Scenario: Repeat import
- **WHEN** the same account is synchronized twice
- **THEN** existing imported entities and daily figures are updated without duplicates

#### Scenario: Incomplete provider response
- **WHEN** any required page fails or holds invalid data
- **THEN** no partial import is published and the previous successful data remains readable

#### Scenario: Spend in micros
- **WHEN** Google reports a day's cost as 12345678 millionths
- **THEN** the project shows 12.3457 in the account's currency

#### Scenario: Currency mismatch
- **WHEN** the account's currency differs from the project's after figures exist
- **THEN** the import is refused and explained without converting amounts

### Requirement: A revoked Google sign-in asks for a new one

When Google rejects or revokes a connection's credential, the connection SHALL keep its
imported data, stop importing, and ask the member in Russian to sign in again; signing in again
SHALL resume imports on the same connection. Disconnecting SHALL delete the credential and stop
future imports while retaining imported data, and in-flight work MUST NOT commit afterwards.

#### Scenario: Access revoked in Google
- **WHEN** the owner of the Google sign-in removes the application's access
- **THEN** the next import marks the connection as needing sign-in and keeps the imported data

#### Scenario: Signing in again
- **WHEN** a member signs in again on that connection
- **THEN** imports resume without a second connection being created

#### Scenario: Disconnecting
- **WHEN** a member disconnects a Google connection
- **THEN** its credential is deleted, its imports stop, and its campaigns remain

### Requirement: Google connections have their own panel and tab

Each Google connection SHALL have its own panel with a refresh control, the last successful
synchronization time and safe failure feedback, following the rules of a Meta panel, with all
copy in Russian. In the campaign tabs a Google connection SHALL be named `Google · account` and
SHALL list only the campaigns imported from it.

#### Scenario: A Meta and a Google account
- **WHEN** a project has one Meta and one Google connection
- **THEN** two tabs appear, Meta · account and Google · account, each listing its own campaigns

#### Scenario: Manual refresh
- **WHEN** an authorized member refreshes a Google connection
- **THEN** an import is queued, the control shows activity, and the figures update on completion
