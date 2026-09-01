## Purpose

The organization is the agency itself and the boundary every other record sits inside. A
membership binds a user account to that organization with exactly one role, so the same
person can hold different roles in different organizations without a second login.

## ADDED Requirements

### Requirement: Access requires an active membership

Every authenticated request SHALL be resolved against a membership in the organization
that owns the addressed data. A user with no membership, or whose membership is
`SUSPENDED`, SHALL be refused.

#### Scenario: Authenticated user without a membership
- **WHEN** a user with a valid access token but no membership calls any `/api` endpoint
  other than the auth endpoints
- **THEN** the API responds 403 with the standard error envelope

#### Scenario: Suspension takes effect immediately
- **WHEN** an admin suspends a member who holds an access token issued minutes earlier
- **THEN** that member's very next request is refused, without waiting for the token to
  expire

### Requirement: A membership carries exactly one role

A membership SHALL carry exactly one of `ADMIN`, `MANAGER`, `GUEST` or `CLIENT`. The role
determines which verbs the member may use; it never by itself determines which rows they
see.

#### Scenario: Role is returned with the session
- **WHEN** a member calls `GET /api/auth/me`
- **THEN** the response names their organization, their role, and the clients they can
  reach

#### Scenario: A role change applies to the next request
- **WHEN** an admin changes a member's role from `MANAGER` to `GUEST`
- **THEN** the next request that member makes is evaluated as a guest

### Requirement: Admins manage membership

Only an `ADMIN` SHALL list members, change a member's role, suspend or reactivate a
member, or remove a member from the organization.

#### Scenario: Manager attempts to change a role
- **WHEN** a manager calls `PATCH /api/members/:id`
- **THEN** the API responds 403 and the membership is unchanged

#### Scenario: The last admin is protected
- **WHEN** an admin tries to demote or remove the only remaining `ADMIN` of the
  organization
- **THEN** the API responds 409 and the membership is unchanged

### Requirement: Removing a member preserves their history

Removing a membership SHALL NOT delete the clients, projects, campaigns or audit events
associated with that member.

#### Scenario: Member removed
- **WHEN** an admin removes a manager who created several clients
- **THEN** those clients and their data remain, and audit events still name that person
