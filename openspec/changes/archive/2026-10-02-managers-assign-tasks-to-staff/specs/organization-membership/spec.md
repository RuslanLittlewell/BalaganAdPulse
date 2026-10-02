## MODIFIED Requirements

### Requirement: Admins manage membership

Only an `ADMIN` SHALL list members, change a member's role, suspend or reactivate a
member, or remove a member from the organization. A `MANAGER` SHALL additionally be able
to list the organization's staff — its admins, managers and guests, never its customers —
so that they can pick a colleague as responsible for a task.

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
