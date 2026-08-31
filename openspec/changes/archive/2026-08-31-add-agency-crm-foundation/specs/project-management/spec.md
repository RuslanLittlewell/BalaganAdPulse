## Purpose

A project is the unit of work the agency runs for a client and the primary object of the
interface: it carries the budget, the dates, the status and the responsible manager, and
groups the sheets that track its daily numbers.

## ADDED Requirements

### Requirement: Projects belong to a client

Every project SHALL belong to exactly one client, and a client SHALL be able to hold
several projects. Sheets SHALL be created under a project, never directly under a client.

#### Scenario: A client with several projects
- **WHEN** a manager creates a second project for a client
- **THEN** both projects are listed for that client, each with its own sheets

#### Scenario: Creating a sheet
- **WHEN** a member creates a sheet
- **THEN** the request addresses a project, and the sheet appears within that project

### Requirement: A project carries planning fields

A project SHALL carry a name, a status of `DRAFT`, `ACTIVE`, `PAUSED`, `COMPLETED` or
`ARCHIVED`, and optionally a budget, a start date, an end date and a responsible manager.

#### Scenario: Project without planning fields
- **WHEN** a project is created with only a name
- **THEN** it is stored with status `ACTIVE` and the optional fields empty

#### Scenario: Assigning a responsible manager
- **WHEN** an admin sets a member with the `MANAGER` role as a project's manager
- **THEN** the project names that member, and setting a member without an active
  membership is refused with 400

### Requirement: Projects are ordered within a client

Projects SHALL carry an explicit position within their client and SHALL be returned in
that order, so the interface order is stable and reorderable.

#### Scenario: Listing projects
- **WHEN** a member lists a client's projects
- **THEN** they are returned by ascending position, not by creation time

### Requirement: Only admins delete projects

Deleting a project SHALL be permitted to `ADMIN` only, and SHALL remove the project's
sheets and their data.

#### Scenario: Manager attempts deletion
- **WHEN** a manager calls `DELETE /api/projects/:id`
- **THEN** the API responds 403 and the project remains
