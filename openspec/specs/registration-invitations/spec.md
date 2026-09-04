# registration-invitations Specification

## Purpose
Registration invitations are backend-owned, typed, short-lived onboarding capabilities that safely select the future client or employee registration experience.

## Requirements

### Requirement: Every invitation has a registration type

An invitation SHALL have exactly one registration type: `CLIENT` or `EMPLOYEE`. An employee invitation SHALL carry one of the employee roles `ADMIN`, `MANAGER`, or `GUEST` and one or more project identifiers; a client invitation SHALL carry neither.

#### Scenario: Valid employee invitation input
- **WHEN** an authorized actor creates an `EMPLOYEE` invitation with a valid role and projects in their organization
- **THEN** the invitation is stored with that role and those projects

#### Scenario: Employee project from another organization
- **WHEN** an actor includes a project outside their organization
- **THEN** the API responds 400 and stores no invitation

#### Scenario: Client invitation includes employee fields
- **WHEN** a caller creates a `CLIENT` invitation with a role or project identifiers
- **THEN** the API responds 400 and stores no invitation

#### Scenario: Employee invitation requests the client role
- **WHEN** a caller creates an `EMPLOYEE` invitation with role `CLIENT`
- **THEN** the API responds 400 and stores no invitation

### Requirement: The backend generates short invitation links

The backend SHALL generate each invitation code as eight cryptographically random characters, SHALL retry on a uniqueness collision, and SHALL return `registrationUrl` in the exact relative form `/regustration/{code}`. A caller SHALL NOT provide or override the code or URL.

#### Scenario: Invitation is created
- **WHEN** a valid invitation creation request succeeds
- **THEN** its code is exactly eight allowed characters and its `registrationUrl` ends with that code

#### Scenario: Generated code collides
- **WHEN** a generated code already belongs to another invitation
- **THEN** the backend generates another code without exposing an error or overwriting the existing invitation

### Requirement: Public resolution selects the registration form

The API SHALL expose an unauthenticated lookup by invitation code that returns only the valid pending invitation's registration type. It SHALL NOT expose organization, role, projects, creator, recipient, or status details.

#### Scenario: Resolving a client link
- **WHEN** a visitor resolves a valid pending client invitation code
- **THEN** the API returns `{ "registrationType": "CLIENT" }`

#### Scenario: Resolving an employee link
- **WHEN** a visitor resolves a valid pending employee invitation code
- **THEN** the API returns `{ "registrationType": "EMPLOYEE" }`

#### Scenario: Probing unusable codes
- **WHEN** a visitor resolves an unknown, revoked, used, or expired code
- **THEN** every case returns the same status and error envelope

### Requirement: Ordinary lists contain pending invitations only

The authenticated invitation-list endpoint SHALL return only unredeemed, unrevoked, unexpired invitations from the actor's organization, optionally filtered by registration type. Revocation SHALL preserve the database row for history while removing it from subsequent ordinary list responses.

#### Scenario: Listing after revocation
- **WHEN** an admin revokes a pending invitation and lists invitations again
- **THEN** the revoked invitation is absent from the response

#### Scenario: Historical rows exist
- **WHEN** a revoked or used invitation is inspected through persistence or a future history capability
- **THEN** its original data and terminal timestamps remain intact

#### Scenario: Filtering employee invitations
- **WHEN** an admin lists invitations with registration type `EMPLOYEE`
- **THEN** only pending employee invitations in their organization are returned

### Requirement: Redemption applies employee project access atomically

Redeeming an employee invitation SHALL create the membership with the invitation's role and project access for every selected project in the same transaction as account creation and invitation claim.

#### Scenario: Employee registration succeeds
- **WHEN** an employee redeems a valid invitation
- **THEN** the account, membership, selected project grants, and invitation claim commit together

#### Scenario: A project grant fails
- **WHEN** any selected project grant cannot be created
- **THEN** account creation, membership creation, every grant, and invitation claim are rolled back

### Requirement: Client registration remains deferred

Resolving a client invitation SHALL identify the client form, but redeeming a client invitation SHALL remain unavailable until client registration is introduced.

#### Scenario: Client registration is attempted early
- **WHEN** a caller tries to redeem a client invitation through the employee registration endpoint
- **THEN** the API refuses it without consuming the invitation

### Requirement: An invitation link is the only way in

The interface SHALL offer no way to register other than following an invitation link.
There SHALL be no screen asking a visitor to type an invitation code, and the sign-in
screen SHALL NOT offer to create an account.

The API SHALL continue to refuse a registration carrying no invitation code, or one that
cannot be redeemed. Removing the screen removes a way to ask, not the rule.

An address that named the removed screen SHALL lead to the sign-in form rather than to a
blank page.

#### Scenario: Nothing offers to create an account

- **WHEN** a signed-out visitor opens the sign-in screen
- **THEN** it offers no link to a registration screen

#### Scenario: A bookmark for the removed screen

- **WHEN** somebody opens `/signup`
- **THEN** they are taken to the sign-in form

#### Scenario: Registering by invitation still works

- **WHEN** a visitor follows a valid invitation link and completes the form it shows
- **THEN** the account is created as before

#### Scenario: The rule is unchanged

- **WHEN** a registration is sent with no invitation code, or with one that cannot be
  redeemed
- **THEN** the API refuses it exactly as it did before

### Requirement: An invitation link opens the form its type calls for

Opening `/regustration/:code` SHALL resolve the invitation's registration type and show
the form for it: the employee form for `EMPLOYEE`, the client form for `CLIENT`. A code
that is unknown, revoked, used or expired SHALL show one message that does not say which
of those it is.

The page SHALL be reachable without a session, since whoever follows the link has none.

#### Scenario: An employee invitation

- **WHEN** a visitor opens the link of a pending employee invitation
- **THEN** the employee registration form is shown

#### Scenario: A client invitation

- **WHEN** a visitor opens the link of a pending client invitation
- **THEN** the client registration form is shown

#### Scenario: A code that cannot be used

- **WHEN** a visitor opens a link whose code is unknown, revoked, used or expired
- **THEN** one message is shown for all four, and no form is offered

### Requirement: The employee form collects an account and an avatar

The employee form SHALL collect a name, an email, a password, a confirmation of that
password, and an avatar the visitor may either upload or generate. It SHALL refuse to
submit when the two passwords differ, and SHALL say so against the confirmation field.

Completing it SHALL create the account, redeem the invitation, and grant the projects the
invitation named — all together, so a failure leaves no half-made member.

#### Scenario: Registering as an employee

- **WHEN** a visitor completes the employee form with matching passwords
- **THEN** the account exists, the invitation is spent, the granted projects are reachable,
  and they are signed in

#### Scenario: Passwords that do not match

- **WHEN** the confirmation differs from the password
- **THEN** the form refuses to submit and says so, and no account is created

#### Scenario: An avatar that was generated rather than uploaded

- **WHEN** a visitor generates an avatar instead of uploading one
- **THEN** the generated avatar is stored against the account and shown wherever the
  member appears

### Requirement: The client form creates a contact and a first project in one step

The client form SHALL have two steps. The first collects the contact's own fields — the
same ones the contact book holds — together with a password and its confirmation, and an
avatar to upload or generate. The second collects a project: the same fields project
creation asks for, including its picture.

Completing the form SHALL create the account, the client record and the project together.
If any part fails, none SHALL be stored — a client with no project, or a project with no
owner, is worse than a link that has to be followed again.

The account it creates SHALL be the client's **principal**, since it is the first person
on that client and somebody has to be able to add the rest.

A visitor SHALL be able to return to the first step without losing what they typed.

#### Scenario: Registering as a client

- **WHEN** a visitor completes both steps of the client form
- **THEN** the account, the client record and the project all exist, the account is that
  client's principal, the invitation is spent, and they are taken to the sign-in form with
  no session left open

#### Scenario: The project step fails

- **WHEN** storing the project is refused
- **THEN** no account and no client record are stored either, and the link still works

#### Scenario: Going back a step

- **WHEN** a visitor returns from the project step to the contact step
- **THEN** everything they typed in the first step is still there

#### Scenario: The admin sees what the client made

- **WHEN** an admin opens the projects module after a client registers
- **THEN** the client's project is listed, and so is any task the client raised on it

### Requirement: An invitation can add somebody to an existing client

A third registration type SHALL exist alongside the client and employee ones: joining a
client that already exists. Such an invitation SHALL name the client it joins, and SHALL
carry no role choice — whoever redeems it becomes an ordinary `CLIENT` of that client.

It SHALL be issued by either side:

- the client's own `CLIENT_ADMIN`, only for their own client;
- an agency `ADMIN`, for any client in the organization.

Redeeming it SHALL create the account, enrol it against that client, and grant it the
same reach the client's other people have — all together, or none of it.

#### Scenario: A principal invites a colleague

- **WHEN** a `CLIENT_ADMIN` creates an invitation for their own client
- **THEN** it is stored against that client and its link resolves to the joining form

#### Scenario: An agency admin invites on the client's behalf

- **WHEN** an admin creates the same invitation, naming any client
- **THEN** it is stored against that client

#### Scenario: A principal naming somebody else's client

- **WHEN** a `CLIENT_ADMIN` creates an invitation naming a client that is not theirs
- **THEN** the API refuses, and the answer is the same one a client that does not exist
  gets

#### Scenario: Redeeming it

- **WHEN** a visitor completes the joining form
- **THEN** the account exists as a `CLIENT` of that client, reaches its projects, the
  invitation is spent, and they are taken to the sign-in form

#### Scenario: A failure part-way

- **WHEN** any part of the redemption is refused
- **THEN** nothing is stored and the link still works

#### Scenario: The form the link opens

- **WHEN** a visitor opens the link
- **THEN** the joining form asks for a name, an email, a password and its confirmation,
  and an avatar — and asks nothing about a company, which already exists

### Requirement: A customer sees only their own client's invitations

Listing invitations SHALL answer a `CLIENT_ADMIN` with the ones for their own client
alone. An agency `ADMIN` continues to see every invitation in the organization.

Revoking follows the same rule: a `CLIENT_ADMIN` SHALL revoke only an invitation for
their own client, and SHALL be told a stranger's invitation does not exist.

#### Scenario: A principal lists invitations

- **WHEN** a `CLIENT_ADMIN` lists invitations
- **THEN** only the pending ones for their own client are returned

#### Scenario: A principal revoking a stranger's invitation

- **WHEN** a `CLIENT_ADMIN` revokes an invitation belonging to another client
- **THEN** the answer is 404
