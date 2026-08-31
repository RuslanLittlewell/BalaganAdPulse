## Purpose

The audit trail is the append-only record of who changed what and when. It answers
"who touched this cell" inside the product rather than in the server logs, and it must
stay trustworthy even after the person who made the change has left the organization.

## ADDED Requirements

### Requirement: Every mutation is recorded

Every create, update and delete on a client, project, sheet, column, row or value SHALL
write exactly one audit event.

#### Scenario: Creating a project
- **WHEN** a manager creates a project
- **THEN** one audit event is recorded with action `CREATE`, the project as its entity,
  and the owning client in its context

#### Scenario: Deleting a sheet
- **WHEN** an admin deletes a sheet
- **THEN** one audit event with action `DELETE` remains readable after the sheet is gone

### Requirement: Events are written in the mutation's transaction

An audit event SHALL be committed in the same database transaction as the change it
describes.

#### Scenario: Failed mutation
- **WHEN** a write fails and its transaction rolls back
- **THEN** no audit event describing it exists

#### Scenario: Failed audit write
- **WHEN** the audit write itself fails
- **THEN** the mutation is rolled back too, and the API responds with an error

### Requirement: An event records the actor as they were

An event SHALL store the actor's name, email and role as they were at the time of the
change, not as a reference resolved when the event is read.

#### Scenario: Actor later removed
- **WHEN** a member is removed from the organization
- **THEN** their past events still name them, with the role they held when they acted

### Requirement: One user action is one event

An action that touches several rows at once SHALL produce one event carrying a list of
changed fields with their before and after values, not one event per row.

#### Scenario: Editing several cells of a day
- **WHEN** a member changes `SPEND` and `LEADS` on the same row in one action
- **THEN** one event is recorded, listing both fields with their old and new values

### Requirement: Events carry a readable summary

Each event SHALL store a human-readable summary computed at write time, so reading the
trail does not depend on the entities still existing or still being named the same.

#### Scenario: Renamed column
- **WHEN** a column is renamed after an edit was recorded against it
- **THEN** the earlier event still reads with the column name that was in use at the time

### Requirement: The trail is append-only

The API SHALL expose no way to modify or delete an audit event, and the application's
database role SHALL NOT hold `UPDATE` or `DELETE` on the audit table.

#### Scenario: Attempting to alter history
- **WHEN** any caller attempts to change or remove an audit event
- **THEN** no endpoint accepts the request

### Requirement: Reading the trail is scoped like everything else

`GET /api/audit` SHALL return only events the caller may reach, and SHALL support
filtering by client, project, sheet, entity, actor and date range, with cursor
pagination.

#### Scenario: Manager reads the trail
- **WHEN** a manager granted two clients reads the audit trail without filters
- **THEN** only events belonging to those two clients are returned, newest first

#### Scenario: Who changed this cell
- **WHEN** a member requests the trail filtered to one row of one sheet
- **THEN** the events for that row are returned in reverse chronological order
