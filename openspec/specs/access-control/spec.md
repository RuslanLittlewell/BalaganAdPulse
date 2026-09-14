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

A CLIENT member SHALL reach the client named by their grant and nothing else: its projects, campaigns, figures, client-visible tasks and its own CRM leads. Every other client, project, campaign, task or CRM lead and the agency CRM SHALL be answered as not found.

A client SHALL be able to read the task module and raise a task on a project they reach. They SHALL NOT change or delete a task once raised or change its visibility. They SHALL be able to create, edit, move and delete leads on their own CRM board. Clients, projects, campaigns and members SHALL remain read-only to them.

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

### Requirement: CRM board reach is enforced independently of task reach
Every CRM request SHALL require an active membership. ADMIN SHALL reach every board in their organization. MANAGER and GUEST SHALL reach the agency board and client boards for which they hold a whole-client grant. A project-only grant SHALL NOT authorize a client-wide CRM board. CLIENT and CLIENT_ADMIN SHALL reach only the board of their own client. Board enumeration, lead queries, mutations, audit and realtime delivery SHALL enforce these same boundaries. Missing or unreachable board and lead identifiers SHALL return 404; missing authentication SHALL return 401. A customer with no valid client grant SHALL receive no board or leads.

#### Scenario: Project-only employee access
- **WHEN** a manager holds only a grant for a single project of client A
- **THEN** client A's CRM is absent from their selector and a direct request for it returns 404

#### Scenario: Customer attempts agency access
- **WHEN** a customer supplies the agency board key or another client's lead id
- **THEN** the API returns 404 and exposes no lead data

#### Scenario: Staff share agency leads
- **WHEN** two active managers open the agency CRM
- **THEN** both see all agency leads regardless of who created them

#### Scenario: Guest writes
- **WHEN** a guest attempts a CRM mutation on a board they can read
- **THEN** the API returns 403 and no change occurs

#### Scenario: Organization boundary
- **WHEN** an admin requests a lead or board in another organization
- **THEN** the API returns 404

### Requirement: CRM write permissions are shared by API and UI
The shared permission matrix SHALL permit ADMIN, MANAGER, CLIENT and CLIENT_ADMIN to create, read, edit, move and delete leads on reachable boards. GUEST SHALL only read. Customers SHALL have no authority to create agency clients by winning leads. These lead permissions SHALL NOT widen permissions for tasks, clients, projects, campaigns or members.

#### Scenario: Customer manages own funnel
- **WHEN** a CLIENT or CLIENT_ADMIN creates, edits, moves or confirms deletion of a lead on their own board
- **THEN** the mutation is accepted and other boards remain unchanged

