## ADDED Requirements

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

## MODIFIED Requirements

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
