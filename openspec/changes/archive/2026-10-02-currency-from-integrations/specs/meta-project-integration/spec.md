## MODIFIED Requirements

### Requirement: Project connection and credential protection

The system SHALL let an agency member whose role may manage integrations connect one Meta account to a reachable project using a numeric Account ID with an optional `act_` prefix and an access token. Customers SHALL NOT manage integrations, even on projects they may edit. Credentials MUST be validated against Meta before replacing an existing connection, encrypted at rest, and excluded from read responses, logs, audit events and browser persistent storage. Connection reads SHALL require the integration permission and project reach. Unknown or unreachable projects SHALL return 404. Connecting an account SHALL give the project the account's currency. When the project already holds imported figures in a different currency, the connection SHALL be refused and the existing connection, currency and figures SHALL remain unchanged.

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
