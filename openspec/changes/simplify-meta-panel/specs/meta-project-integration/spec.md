## MODIFIED Requirements

### Requirement: Manual refresh and visible status

The project interface SHALL provide Russian-language connection controls, a manual refresh action, last successful synchronization time and safe failure feedback. While an import is queued or running, the refresh control SHALL show activity and SHALL NOT accept another request. When nothing has failed, the panel SHALL show its heading but SHALL NOT show schedule text or a status line naming the synchronization state, account or currency; failure feedback SHALL appear only while the failure applies. Manual refresh SHALL require project update permission and reach. Concurrent requests SHALL result in at most one active import per project. Successful completion SHALL refresh the displayed campaign data and summaries.

#### Scenario: Request refresh
- **WHEN** an authorized member clicks refresh on a connected project
- **THEN** a server-side import is queued and the refresh control shows activity, followed by updated data and a new last successful synchronization time or an actionable error

#### Scenario: Expired token
- **WHEN** Meta rejects a saved token during import
- **THEN** the interface requests token replacement while retaining previously imported data

#### Scenario: Healthy connection
- **WHEN** a member opens a project whose last import succeeded
- **THEN** the panel shows its heading and the last successful synchronization time, and no schedule, status, account or currency text
