## MODIFIED Requirements

### Requirement: Public resolution selects the registration form

The API SHALL expose an unauthenticated lookup by invitation code that returns the valid pending invitation's registration type and the email address it is bound to, or `null` when it is bound to none. It SHALL NOT expose organization, role, projects, creator, or status details.

#### Scenario: Resolving a client link
- **WHEN** a visitor resolves a valid pending client invitation code bound to no address
- **THEN** the API returns `{ "registrationType": "CLIENT", "email": null }`

#### Scenario: Resolving an employee link
- **WHEN** a visitor resolves a valid pending employee invitation code bound to no address
- **THEN** the API returns `{ "registrationType": "EMPLOYEE", "email": null }`

#### Scenario: Resolving a link bound to an address
- **WHEN** a visitor resolves a valid pending invitation code bound to `owner@acme.com`
- **THEN** the API returns its registration type and `"email": "owner@acme.com"`

#### Scenario: Probing unusable codes
- **WHEN** a visitor resolves an unknown, revoked, used, or expired code
- **THEN** every case returns the same status and error envelope

### Requirement: The employee form collects an account and an avatar

The employee form SHALL collect a name, a password, a confirmation of that password, and
an avatar the visitor may either upload or generate. It SHALL collect an email only when
the invitation is bound to none; when it is bound, the form SHALL show that address as the
account's email, not ask for one, and register with it. It SHALL refuse to submit when the
two passwords differ, and SHALL say so against the confirmation field.

Completing it SHALL create the account, redeem the invitation, and grant the projects the
invitation named — all together, so a failure leaves no half-made member.

#### Scenario: Registering as an employee

- **WHEN** a visitor completes the employee form with matching passwords
- **THEN** the account exists, the invitation is spent, the granted projects are reachable,
  and they are signed in

#### Scenario: An invitation bound to an address

- **WHEN** a visitor opens the link of an employee invitation bound to `owner@acme.com`
- **THEN** the form shows `owner@acme.com`, offers no email field, and the account it
  creates signs in with that address

#### Scenario: Passwords that do not match

- **WHEN** the confirmation differs from the password
- **THEN** the form refuses to submit and says so, and no account is created

#### Scenario: An avatar that was generated rather than uploaded

- **WHEN** a visitor generates an avatar instead of uploading one
- **THEN** the generated avatar is stored against the account and shown wherever the
  member appears

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
- **THEN** the joining form asks for a name, a password and its confirmation, and an
  avatar, and for an email only when the invitation is bound to none — and asks nothing
  about a company, which already exists

## ADDED Requirements

### Requirement: A registration form never asks for an email the invitation fixes

Whichever form a link opens — employee, client or joining — an invitation bound to an
address SHALL have that address shown as the account's email and used to register, with
no email field to fill in. The client form SHALL also use it as the new client's contact
email. An invitation bound to no address SHALL keep asking for one.

#### Scenario: A client invitation bound to an address

- **WHEN** a visitor completes the client form of an invitation bound to `owner@acme.com`
- **THEN** the account and the client's contact both carry `owner@acme.com`, and no email
  was asked for

#### Scenario: An unbound invitation

- **WHEN** a visitor opens the link of an invitation bound to no address
- **THEN** the form asks for an email as before
