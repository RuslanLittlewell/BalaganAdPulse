# organization-membership Specification

## Purpose
The organization is the agency itself and the boundary every other record sits inside. A
membership binds a user account to that organization with exactly one role, so the same
person can hold different roles in different organizations without a second login.

## Requirements

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

### Requirement: Members are administered through the API alone

The web interface SHALL offer one place to look at the organization's members — the
contact book's employee directory — and that view SHALL be read-only. It SHALL NOT offer
a control that changes a member's role or status, or removes them from the organization.

The API SHALL continue to accept all three changes, with the rules it already enforces
unchanged: only an admin may make them, an admin may not remove their own membership,
and the last admin may not be removed. Removing the interface removes a way to ask, not
a rule about who may.

An address that named the removed section SHALL lead somewhere useful rather than to a
blank screen.

#### Scenario: Looking at the members

- **WHEN** a member opens the contact book's employee pane
- **THEN** each member is shown with their name, email and role, and no control changes
  any of them

#### Scenario: No navigation entry

- **WHEN** any member looks at the main navigation
- **THEN** it offers no Team section, whatever their role

#### Scenario: An address that named the removed section

- **WHEN** someone opens `/team` from a bookmark
- **THEN** they are taken to the dashboard

#### Scenario: The rules are unchanged

- **WHEN** an admin changes a member's role through the API
- **THEN** it is accepted exactly as before, and the same refusals apply

### Requirement: A person carries the ways of reaching them

A person SHALL carry an optional phone number and an optional Telegram handle beside
their name and email. Both SHALL be offered at registration and SHALL be editable
afterwards by that person, in the same place they change the rest of their profile.

Neither SHALL be required: an account is not worth refusing over a missing phone number,
and a person who has not given one is shown as having none rather than as having a blank.

Wherever people are listed for the purpose of reaching them — the agency's employee
directory, and a client's own company — both SHALL be shown.

#### Scenario: Registering with them

- **WHEN** a visitor completes any registration form having filled the phone and Telegram
- **THEN** both are stored against the account and shown wherever that person is listed

#### Scenario: Registering without them

- **WHEN** a visitor completes a registration form leaving both empty
- **THEN** the account is created, and the person is listed with no phone and no Telegram

#### Scenario: Changing them later

- **WHEN** a member edits their phone or Telegram in profile settings
- **THEN** the change is stored and shown wherever they are listed

#### Scenario: A directory shows how to reach somebody

- **WHEN** a member opens the employee directory, or a customer opens their company
- **THEN** each person is shown with their email, phone and Telegram, and a missing one
  reads as absent rather than as an empty space

#### Scenario: Nobody edits somebody else's

- **WHEN** a member tries to change another person's phone or Telegram
- **THEN** the API refuses: these belong to the person, not to the directory

### Requirement: A member's grants can be read

The grants a membership holds SHALL be readable, not only replaceable. Reading them
SHALL follow the same rule as changing them: an admin reaches every membership in the
organization, and anybody else is told a membership they cannot reach does not exist.

#### Scenario: Reading a member's grants

- **WHEN** an admin asks for a member's grants
- **THEN** every grant that membership holds is returned, each naming its client and, when
  the grant is narrowed to one, its project

#### Scenario: A member with no grants

- **WHEN** an admin asks for the grants of a member who holds none
- **THEN** an empty list is returned

#### Scenario: Reading grants without the authority to

- **WHEN** somebody who may not administer members asks for a member's grants
- **THEN** the API refuses

#### Scenario: A membership in another organization

- **WHEN** an admin asks for the grants of a membership outside their organization
- **THEN** the answer is 404, the same answer a membership that does not exist gets

### Requirement: Signing out ends the session and returns to the sign-in form

Signing out SHALL end the session and take the person to the sign-in form, whether or not
the request revoking it reached the server. Nothing the previous session loaded SHALL
remain readable afterwards, and returning to a protected address SHALL ask for
credentials rather than restore what was on screen.

A network failure while signing out SHALL NOT leave someone inside a session they asked
to leave.

#### Scenario: Signing out

- **WHEN** a signed-in member signs out
- **THEN** they are taken to the sign-in form and the session is over

#### Scenario: Signing out while the server is unreachable

- **WHEN** the request revoking the session fails
- **THEN** the member is still signed out locally and still taken to the sign-in form

#### Scenario: Going back after signing out

- **WHEN** a signed-out visitor opens a protected address
- **THEN** they are shown the sign-in form, not the previous session's data

#### Scenario: The next person on the same computer

- **WHEN** someone signs in after another member signed out on that browser
- **THEN** they see their own clients, projects and tasks, never the previous member's
