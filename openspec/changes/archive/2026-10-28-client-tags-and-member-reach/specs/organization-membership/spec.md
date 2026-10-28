## MODIFIED Requirements

### Requirement: Admins manage membership

Only an `ADMIN` SHALL list members, change a member's role, suspend or reactivate a
member, or remove a member from the organization. A `MANAGER` SHALL additionally be able
to list the organization's staff — its admins, managers and guests, never its customers —
so that they can name a colleague on a task, and to list the people of a
client — everyone holding an access grant on it or on one of its projects — so that they
can name the client's people on a task. Listing a client's people MAY be narrowed to one of
its projects, returning only those whose grants reach that project. A `CLIENT_ADMIN` SHALL
list, in place of every member, only the people of the clients they reach, as listing those
clients' people returns them, and never another client's people nor the rest of the agency.

#### Scenario: Manager attempts to change a role
- **WHEN** a manager calls `PATCH /api/members/:id`
- **THEN** the API responds 403 and the membership is unchanged

#### Scenario: The last admin is protected
- **WHEN** an admin tries to demote or remove the only remaining `ADMIN` of the
  organization
- **THEN** the API responds 409 and the membership is unchanged

#### Scenario: Manager lists the staff
- **WHEN** a manager calls `GET /api/members?kind=staff`
- **THEN** the organization's admins, managers and guests are returned, including the
  manager, and no customer

#### Scenario: Manager lists every member
- **WHEN** a manager calls `GET /api/members` without `kind=staff`
- **THEN** the API responds 403

#### Scenario: Guest lists the staff
- **WHEN** a guest calls `GET /api/members?kind=staff`
- **THEN** the API responds 403

#### Scenario: Manager lists a client's people
- **WHEN** a manager calls `GET /api/members?clientId=` for a client of their organization
- **THEN** the members holding a grant on that client or on one of its projects are returned

#### Scenario: A client's people who reach one project
- **WHEN** a manager calls `GET /api/members?clientId=&projectId=` for a project of that client
- **THEN** only the members whose grants reach that project are returned: those granted the
  whole client and those granted that project

#### Scenario: Guest lists a client's people
- **WHEN** a guest calls `GET /api/members?clientId=`
- **THEN** the API responds 403

#### Scenario: A principal lists members
- **WHEN** the principal of client A calls `GET /api/members` in an organization that also has
  client B with its own people
- **THEN** only the people of client A are returned, and none of client B's people nor an
  admin without a grant on client A
