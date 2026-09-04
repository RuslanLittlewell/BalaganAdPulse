# client-management Specification

## Purpose
A client is the agency's customer, and it belongs to the organization rather than to the
person who happened to enter it. This capability covers that ownership move and who is
permitted to remove a client; the client's own fields are unchanged by it.

## Requirements

### Requirement: A client belongs to an organization

Every client SHALL belong to exactly one organization. No client SHALL be owned by an
individual user, and reassigning who works on a client SHALL NOT change the client row.

#### Scenario: Reassigning an account
- **WHEN** an admin moves a client from one manager to another
- **THEN** only the access grants change, and the client, its projects and its campaign
  data are untouched

#### Scenario: Existing clients keep their data
- **WHEN** the organization is introduced over a database that already holds clients
- **THEN** every client is attached to the organization with its fields, projects and
  campaigns intact, and the members who could reach it before can still reach it

### Requirement: Creating a client grants its creator access

Creating a client SHALL give the member who created it reach over that client, unless
their role already reaches the whole organization. A member SHALL NOT be able to create a
client they cannot then see.

#### Scenario: A manager creates a client
- **WHEN** a manager creates a client
- **THEN** the client appears in their own list, and they can read and edit it

#### Scenario: An admin creates a client
- **WHEN** an admin creates a client
- **THEN** no grant is recorded for them, because their role already reaches every client
  of the organization

#### Scenario: One manager's new client is invisible to another
- **WHEN** two managers each create a client
- **THEN** each sees only their own

### Requirement: Only admins delete clients

Deleting a client SHALL be permitted to `ADMIN` only. Deleting a client SHALL remove its
projects, campaigns and their data.

#### Scenario: Manager attempts deletion
- **WHEN** a manager calls `DELETE /api/clients/:id` for a client they are granted
- **THEN** the API responds 403 and the client remains

#### Scenario: Admin deletes a client
- **WHEN** an admin deletes a client
- **THEN** the client, its projects, its campaigns and their values are removed, and the
  audit events describing them remain

### Requirement: A client's own fields are unchanged

Introducing organization ownership SHALL NOT add, remove or rename any other column of a
client. The contact-book fields and the client picture SHALL keep their present behaviour.

#### Scenario: The contact book still works
- **WHEN** a member opens a client after the organization is introduced
- **THEN** the full name, organization, UNP, phone, telegram, email, website and picture
  are all present and editable exactly as before
