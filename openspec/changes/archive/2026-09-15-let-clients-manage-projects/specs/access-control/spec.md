## MODIFIED Requirements

### Requirement: Clients reach only their own client

A CLIENT member SHALL reach the client named by their grant and nothing else: its projects, campaigns, figures, client-visible tasks and its own CRM leads. Every other client, project, campaign, task or CRM lead and the agency CRM SHALL be answered as not found.

A client SHALL be able to read the task module and raise a task on a project they reach. They SHALL NOT change or delete a task once raised or change its visibility. They SHALL be able to create, edit, move and delete leads on their own CRM board. They SHALL be able to create projects for their own client and edit the name, niche, monthly budget, currency and picture of their client's projects. They SHALL NOT delete a project, change its priority, manage its advertising connection or set its KPIs. Clients, campaigns and members SHALL remain read-only to them.

#### Scenario: A client's projects
- **WHEN** a client opens the projects module
- **THEN** only their own client's projects are listed

#### Scenario: A client's dashboard
- **WHEN** a client opens the dashboard
- **THEN** figures cover their own projects alone

#### Scenario: A client raising a task
- **WHEN** a client raises a task on a project they reach
- **THEN** it is stored, appears on their board, and the agency sees it too

#### Scenario: A client editing a task
- **WHEN** a client tries to change or delete a task
- **THEN** the API refuses with 403 and the task is unchanged

#### Scenario: Client requests another client's project
- **WHEN** a client opens another client's project address
- **THEN** the answer is 404

#### Scenario: A client reaching for the agency's own task
- **WHEN** a client opens an unshared task on their project
- **THEN** the answer is 404

#### Scenario: A client manages a lead
- **WHEN** a client edits a lead on their own CRM board
- **THEN** the edit succeeds without granting authority over other resources

#### Scenario: A client creates a project
- **WHEN** a client creates a project for their own client
- **THEN** it is stored for that client and the agency's admins see it in the projects module

#### Scenario: A client names another client
- **WHEN** a client creates a project naming a client that is not theirs
- **THEN** the answer is 404 and nothing is stored

#### Scenario: A client edits a project
- **WHEN** a client changes the name, niche, budget or currency of their client's project
- **THEN** the change is stored and audited under their name

#### Scenario: Agency-only project actions
- **WHEN** a client tries to delete a project, change its priority, connect its advertising account or set its KPI
- **THEN** the API responds 403 and nothing changes

### Requirement: A client's people hold their own memberships

A client SHALL be able to have several people. Each holds a membership of the
organization that reaches exactly one client — the same reach the client's own account
has — and nothing else in the organization.

Two customer roles SHALL exist:

- `CLIENT_ADMIN` — the principal. Administers the client's own people: invites them, sees
  the invitations they hold, revokes one, and removes somebody who has joined.
- `CLIENT` — everybody else on the customer's side. Reads what the client reads, raises
  tasks, creates and edits the client's projects, and administers nobody.

Both SHALL create and edit their own client's projects as a client may. Clients,
campaigns and the agency's members SHALL stay read-only to both. A `CLIENT_ADMIN`'s extra
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

- **WHEN** either customer role tries to create or change a client or campaign
- **THEN** the API responds 403

#### Scenario: Both manage their client's projects

- **WHEN** a `CLIENT` or a `CLIENT_ADMIN` creates a project for their client or edits one
- **THEN** it is allowed
