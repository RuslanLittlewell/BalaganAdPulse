## Purpose

A client is the agency's customer as a CRM record: it belongs to the organization rather
than to a person, carries a lifecycle from prospect to archived, and is the parent every
project hangs from.

## ADDED Requirements

### Requirement: A client belongs to an organization

Every client SHALL belong to exactly one organization. No client SHALL be owned by an
individual user, and reassigning who works on a client SHALL NOT change the client row.

#### Scenario: Reassigning an account
- **WHEN** an admin moves a client from one manager to another
- **THEN** only the access grants change, and the client, its projects and its sheet data
  are untouched

### Requirement: Clients carry a lifecycle status

A client SHALL have a status of `LEAD`, `ACTIVE`, `PAUSED` or `ARCHIVED`, defaulting to
`ACTIVE`. A `LEAD` SHALL be storable with no projects at all.

#### Scenario: Recording a prospect
- **WHEN** a manager creates a client with status `LEAD`
- **THEN** the client is stored and listed, and no project is required

#### Scenario: Filtering by status
- **WHEN** a member lists clients filtered by status
- **THEN** only clients in that status, and within their access, are returned

### Requirement: Creating a client seeds its first project and sheet

Creating a client SHALL create one project and, inside it, one sheet carrying the default
column set, so a new client is immediately usable.

#### Scenario: New client is ready to use
- **WHEN** an admin or manager creates a client
- **THEN** the response includes one project containing one sheet whose columns are the
  default set

### Requirement: Only admins delete clients

Deleting a client SHALL be permitted to `ADMIN` only. Deleting a client SHALL remove its
projects, sheets and sheet data.

#### Scenario: Manager attempts deletion
- **WHEN** a manager calls `DELETE /api/clients/:id` for a client they are granted
- **THEN** the API responds 403 and the client remains

#### Scenario: Admin deletes a client
- **WHEN** an admin deletes a client
- **THEN** the client, its projects, its sheets and their values are removed, and the
  audit events describing them remain
