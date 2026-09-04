## ADDED Requirements

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

## MODIFIED Requirements

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
