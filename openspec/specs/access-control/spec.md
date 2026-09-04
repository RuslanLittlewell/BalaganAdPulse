# access-control Specification

## Purpose
Access control decides two separate questions: which rows a member can reach, and which
verbs their role permits on those rows. Row reach comes from explicit grants, verbs come
from the role, and both are answered by one shared permission matrix.

## Requirements

### Requirement: Admins reach the whole organization

An `ADMIN` SHALL reach every client, project, campaign and audit event in their
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
- **WHEN** a manager requests a client, project or campaign they hold no grant for
- **THEN** the API responds 404, the same answer a genuinely missing id gets, so the
  response does not reveal that the record exists

#### Scenario: Project-scoped grant
- **WHEN** a member holds a grant naming one project of a client with three projects
- **THEN** listing that client's projects returns only the granted project

### Requirement: Guests never write

A `GUEST` SHALL be refused every create, update and delete, on every resource, regardless
of their grants.

#### Scenario: Guest edits a cell
- **WHEN** a guest sends a write to a campaign value inside a client they are granted
- **THEN** the API responds 403 and no value is stored

### Requirement: Clients reach only their own client

A `CLIENT` member SHALL reach the client named by their grant and nothing else: its
projects, the campaigns under them, the figures those campaigns measured, and the tasks
on those projects that are marked visible to the client. Every other client, project,
campaign and task in the organization SHALL be answered as not found.

A client SHALL be able to read the task module and raise a task on a project they reach.
They SHALL NOT change or delete a task once it is raised, SHALL NOT change whether a task
is visible to them, and SHALL NOT write anything else: clients, projects, campaigns and
members stay read-only to them.

#### Scenario: A client's projects

- **WHEN** a client opens the projects module
- **THEN** the projects of their own client are listed, and no others

#### Scenario: A client's dashboard

- **WHEN** a client opens the dashboard
- **THEN** the figures shown cover their own projects alone

#### Scenario: A client raising a task

- **WHEN** a client raises a task on a project they reach
- **THEN** it is stored, it appears on their board, and the agency sees it too

#### Scenario: A client editing a task

- **WHEN** a client tries to change or delete a task
- **THEN** the API refuses with 403 and the task is unchanged

#### Scenario: Client requests another client's project

- **WHEN** a client opens the address of a project belonging to another client
- **THEN** the answer is 404

#### Scenario: A client reaching for the agency's own task

- **WHEN** a client opens the address of a task on their project that is not marked
  visible to them
- **THEN** the answer is 404

### Requirement: One permission matrix serves the API and the UI

The role-to-permission matrix SHALL exist once, as data, and be consumed by both the API
and the web app. Hiding a control in the UI SHALL NOT be the only thing preventing an
action.

#### Scenario: UI hides what the API refuses
- **WHEN** a guest opens a project
- **THEN** the edit and delete controls are absent, and a request issued directly against
  the API is refused as well

### Requirement: A client's people hold their own memberships

A client SHALL be able to have several people. Each holds a membership of the
organization that reaches exactly one client — the same reach the client's own account
has — and nothing else in the organization.

Two customer roles SHALL exist:

- `CLIENT_ADMIN` — the principal. Administers the client's own people: invites them, sees
  the invitations they hold, revokes one, and removes somebody who has joined.
- `CLIENT` — everybody else on the customer's side. Reads what the client reads and
  raises tasks, and administers nobody.

Neither SHALL write anything the current `CLIENT` role cannot: clients, projects,
campaigns and the agency's members stay read-only to both. A `CLIENT_ADMIN`'s extra
authority is over its own client's people and nothing else.

#### Scenario: A client's employee reaches the client's work

- **WHEN** a person the client added opens the projects module
- **THEN** they see the client's projects, and nothing belonging to another client

#### Scenario: A principal administers their own people

- **WHEN** a `CLIENT_ADMIN` invites, revokes or removes somebody on their own client
- **THEN** it is allowed

#### Scenario: A principal reaching for the agency

- **WHEN** a `CLIENT_ADMIN` tries to invite an employee of the agency, or to touch a
  member of another client
- **THEN** the API refuses

#### Scenario: An ordinary customer administers nobody

- **WHEN** a `CLIENT` tries to invite or remove anybody
- **THEN** the API responds 403

#### Scenario: Neither writes the agency's records

- **WHEN** either customer role tries to create or change a client, project or campaign
- **THEN** the API responds 403
