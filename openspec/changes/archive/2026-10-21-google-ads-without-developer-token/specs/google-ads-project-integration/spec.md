## MODIFIED Requirements

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
