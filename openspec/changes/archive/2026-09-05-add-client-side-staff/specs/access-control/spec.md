## ADDED Requirements

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
