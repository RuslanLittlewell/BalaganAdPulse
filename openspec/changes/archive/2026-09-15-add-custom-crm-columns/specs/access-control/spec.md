## MODIFIED Requirements

### Requirement: CRM write permissions are shared by API and UI
The shared permission matrix SHALL permit ADMIN, MANAGER, CLIENT and CLIENT_ADMIN to create, read, edit, move and delete leads, and to create, rename, move and delete custom columns, on reachable boards. GUEST SHALL only read. Customers SHALL have no authority to create agency clients by winning leads. These lead permissions SHALL NOT widen permissions for tasks, clients, projects, campaigns or members.

#### Scenario: Customer manages own funnel
- **WHEN** a CLIENT or CLIENT_ADMIN creates, edits, moves or confirms deletion of a lead on their own board
- **THEN** the mutation is accepted and other boards remain unchanged

#### Scenario: Customer manages own columns
- **WHEN** a CLIENT creates, renames, moves or deletes a custom column on their own board
- **THEN** the change is accepted and other boards' columns remain unchanged

#### Scenario: Guest columns
- **WHEN** a guest tries to create or change a column on a board they can read
- **THEN** the API responds 403 and nothing changes
