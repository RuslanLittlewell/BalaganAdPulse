## MODIFIED Requirements

### Requirement: Project connection and credential protection

The system SHALL let an agency member whose role may manage integrations connect one Meta account to a reachable project using a numeric Account ID with an optional `act_` prefix and an access token. Customers SHALL NOT manage integrations, even on projects they may edit. Credentials MUST be validated against Meta before replacing an existing connection, encrypted at rest, and excluded from read responses, logs, audit events and browser persistent storage. Connection reads SHALL require the integration permission and project reach. Unknown or unreachable projects SHALL return 404.

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

### Requirement: Manual refresh and visible status

The project interface SHALL provide Russian-language connection controls, a manual refresh action, last successful synchronization time and safe failure feedback. While an import is queued or running, the refresh control SHALL show activity and SHALL NOT accept another request. When nothing has failed, the panel SHALL show its heading but SHALL NOT show schedule text or a status line naming the synchronization state, account or currency; failure feedback SHALL appear only while the failure applies. Manual refresh SHALL require the integration permission and reach. Concurrent requests SHALL result in at most one active import per project. Successful completion SHALL refresh the displayed campaign data and summaries.

#### Scenario: Request refresh
- **WHEN** an authorized member clicks refresh on a connected project
- **THEN** a server-side import is queued and the refresh control shows activity, followed by updated data and a new last successful synchronization time or an actionable error

#### Scenario: Expired token
- **WHEN** Meta rejects a saved token during import
- **THEN** the interface requests token replacement while retaining previously imported data

#### Scenario: Healthy connection
- **WHEN** a member opens a project whose last import succeeded
- **THEN** the panel shows its heading and the last successful synchronization time, and no schedule, status, account or currency text
