## MODIFIED Requirements

### Requirement: Reading the trail is scoped like everything else

`GET /api/audit` SHALL return only events the caller may reach, and SHALL support
filtering by client, project, campaign, entity, actor and date range, and to events tied to
any project with `inProject=true`, with cursor pagination. `GET /api/audit/actors` SHALL list
the members who are the actor of at least one event the caller may reach, each with their id
and current name, ordered by name.

#### Scenario: Manager reads the trail
- **WHEN** a manager granted two clients reads the audit trail without filters
- **THEN** only events belonging to those two clients are returned, newest first

#### Scenario: Who changed this cell
- **WHEN** a member requests the trail filtered to one row of one campaign
- **THEN** the events for that row are returned in reverse chronological order

#### Scenario: Only what concerns projects
- **WHEN** an admin reads the trail with `inProject=true`
- **THEN** only events that carry a project are returned

#### Scenario: Who appears in the trail
- **WHEN** a manager granted one client reads `GET /api/audit/actors`
- **THEN** the list holds the people who acted on that client's events, and nobody who acted only elsewhere

## ADDED Requirements

### Requirement: Coming online and going offline are recorded

The system SHALL record an `ONLINE` event when a member becomes present and an `OFFLINE`
event when they stop being present, with the member as both actor and entity. An `OFFLINE`
event SHALL be dated at the member's last authenticated request when their presence lapsed
through five minutes of silence, and at the moment of signing out when they signed out. These
events SHALL carry no client, project or campaign, so only a reader who reaches the whole
organization SHALL read them.

#### Scenario: Coming online
- **WHEN** a member who was away makes an authenticated request
- **THEN** an `ONLINE` event with that member as actor is recorded

#### Scenario: Going quiet
- **WHEN** a member's last request was at 10:00 and five minutes pass without another
- **THEN** an `OFFLINE` event dated 10:00 is recorded

#### Scenario: Signing out
- **WHEN** a member signs out
- **THEN** an `OFFLINE` event dated at that moment is recorded

#### Scenario: Only admins see it
- **WHEN** a manager reads the trail
- **THEN** no `ONLINE` or `OFFLINE` event is among the results
