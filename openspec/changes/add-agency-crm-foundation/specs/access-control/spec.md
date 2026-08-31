## Purpose

Access control decides two separate questions: which rows a member can reach, and which
verbs their role permits on those rows. Row reach comes from explicit grants, verbs come
from the role, and both are answered by one shared permission matrix.

## ADDED Requirements

### Requirement: Admins reach the whole organization

An `ADMIN` SHALL reach every client, project, sheet and audit event in their
organization without needing an access grant.

#### Scenario: Admin lists clients
- **WHEN** an admin calls `GET /api/clients`
- **THEN** every client of their organization is returned, including clients created by
  other members

#### Scenario: Admin never reaches another organization
- **WHEN** an admin requests a client belonging to a different organization by id
- **THEN** the API responds 404

### Requirement: Managers and guests reach only granted clients

A `MANAGER` or `GUEST` SHALL reach a client only when an access grant names that client
for their membership. A grant may name a single project, in which case only that project
of that client is reachable.

#### Scenario: List is filtered to grants
- **WHEN** a manager granted two of the organization's ten clients calls `GET /api/clients`
- **THEN** exactly those two clients are returned

#### Scenario: Fetching an ungranted record by id
- **WHEN** a manager requests a client, project or sheet they hold no grant for
- **THEN** the API responds 404, the same answer a genuinely missing id gets, so the
  response does not reveal that the record exists

#### Scenario: Project-scoped grant
- **WHEN** a member holds a grant naming one project of a client with three projects
- **THEN** listing that client's projects returns only the granted project

### Requirement: Guests never write

A `GUEST` SHALL be refused every create, update and delete, on every resource, regardless
of their grants.

#### Scenario: Guest edits a cell
- **WHEN** a guest sends a write to a sheet value inside a client they are granted
- **THEN** the API responds 403 and no value is stored

### Requirement: Clients reach only their own client

A `CLIENT` SHALL reach exactly the client record their grant names, and nothing else in
the organization.

#### Scenario: Client requests another client's project
- **WHEN** a client-role member requests a project belonging to a different client
- **THEN** the API responds 404

### Requirement: One permission matrix serves the API and the UI

The role-to-permission matrix SHALL exist once, as data, and be consumed by both the API
and the web app. Hiding a control in the UI SHALL NOT be the only thing preventing an
action.

#### Scenario: UI hides what the API refuses
- **WHEN** a guest opens a project
- **THEN** the edit and delete controls are absent, and a request issued directly against
  the API is refused as well
