## ADDED Requirements

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

A visitor SHALL be able to return to the first step without losing what they typed.

#### Scenario: Registering as a client

- **WHEN** a visitor completes both steps of the client form
- **THEN** the account, the client record and the project all exist, the invitation is
  spent, and they are taken to the sign-in form with no session left open

#### Scenario: The project step fails

- **WHEN** storing the project is refused
- **THEN** no account and no client record are stored either, and the link still works

#### Scenario: Going back a step

- **WHEN** a visitor returns from the project step to the contact step
- **THEN** everything they typed in the first step is still there

#### Scenario: The admin sees what the client made

- **WHEN** an admin opens the projects module after a client registers
- **THEN** the client's project is listed, and so is any task the client raised on it
