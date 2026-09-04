## ADDED Requirements

### Requirement: A client's people are listed to the client

A customer's contact book SHALL be their own company's people: who is on it, how to reach
each of them, which of them is the principal, and — for the principal — a way to invite
another.

The agency's client card SHALL hold the company's contact details alone. Its people are
not listed there: the card is about the company, and a second list beside the invitations
already on it said the same thing twice.

A client's people SHALL NOT appear in the employee directory, which is the agency's own.

#### Scenario: The agency looks at a client

- **WHEN** an admin opens a client in the contact book
- **THEN** the company's contact details are shown, and no list of its people

#### Scenario: A client's people are not the agency's

- **WHEN** an admin opens the employee directory
- **THEN** no customer appears there, whichever client they belong to

#### Scenario: The principal looks at their own company

- **WHEN** a `CLIENT_ADMIN` opens their company's people
- **THEN** they see who is on it, the invitations outstanding, and a way to invite another

#### Scenario: An ordinary customer looks at the same list

- **WHEN** a `CLIENT` opens it
- **THEN** they see who is on the company and no control that invites or removes anybody
