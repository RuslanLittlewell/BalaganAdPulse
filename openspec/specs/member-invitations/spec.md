# member-invitations Specification

## Purpose
An invitation is how a person becomes a member. It names the role the invitee will
hold before they ever sign up, so joining the organization is an act an admin
authorises rather than something anyone holding a shared secret can do.

## Requirements

### Requirement: An invitation names the role it grants

An invitation SHALL carry exactly one role, chosen from `ADMIN`, `MANAGER`, `GUEST` and
`CLIENT` when it is created. Redeeming it SHALL create a membership with that role, and
the role SHALL NOT be chosen or overridden by the person redeeming it.

#### Scenario: Creating an invitation for a manager
- **WHEN** an admin creates an invitation naming the `MANAGER` role
- **THEN** the invitation is stored with that role and a code the admin can pass on

#### Scenario: The invitee cannot choose their own role
- **WHEN** someone registers with a `MANAGER` invitation and asks for the `ADMIN` role in
  the same request
- **THEN** the membership created holds `MANAGER`, the role the invitation named

#### Scenario: An unknown role is refused
- **WHEN** an admin creates an invitation naming a role outside the four
- **THEN** the API responds 400 and no invitation is stored

### Requirement: Only admins manage invitations

Creating, listing and revoking invitations SHALL be permitted to `ADMIN` only.

#### Scenario: Manager attempts to invite
- **WHEN** a manager calls `POST /api/invites`
- **THEN** the API responds 403 and no invitation is stored

#### Scenario: Admin lists invitations
- **WHEN** an admin lists invitations
- **THEN** every invitation of their organization is returned with its role and its
  status, and never an invitation belonging to another organization

### Requirement: An invitation is redeemed once

An invitation SHALL be usable exactly once. Once redeemed it SHALL record who redeemed it
and when, and SHALL be refused thereafter.

#### Scenario: Reusing a code
- **WHEN** a second person registers with a code that has already been redeemed
- **THEN** the API responds 403 and no second account is created

#### Scenario: Redemption records the joiner
- **WHEN** a person registers with a valid invitation
- **THEN** the invitation names them as the person who used it, and the time they did

### Requirement: An invitation can expire and can be revoked

An invitation MAY carry an expiry. An admin SHALL be able to revoke an unredeemed
invitation. An expired or revoked invitation SHALL be refused, and revoking SHALL NOT
remove the record of an invitation that was already redeemed.

#### Scenario: Registering with an expired invitation
- **WHEN** a person registers with an invitation whose expiry has passed
- **THEN** the API responds 403 and no account is created

#### Scenario: Revoking before it is used
- **WHEN** an admin revokes a pending invitation and the invitee then tries to register
- **THEN** the API responds 403 and no account is created

#### Scenario: A redeemed invitation keeps its history
- **WHEN** an admin tries to revoke an invitation that has already been redeemed
- **THEN** the API responds 409, and the invitation still names who used it and when

### Requirement: A refused invitation never explains itself

Unknown, expired, revoked, already-redeemed and wrong-recipient invitations SHALL all be
refused with the same status and the same message, so a stranger cannot use registration
to learn which codes exist or which addresses were invited.

#### Scenario: Probing for valid codes
- **WHEN** a stranger registers with a code that does not exist, and then with one that
  exists but is already redeemed
- **THEN** both responses are identical in status and message

### Requirement: Registration requires an invitation

Registering SHALL require a valid invitation, and SHALL create the account and its
membership together. Neither SHALL exist without the other.

#### Scenario: Registering without an invitation
- **WHEN** someone registers with no invitation code
- **THEN** the API responds 400 and no account is created

#### Scenario: A failed membership leaves no account
- **WHEN** the membership cannot be created while registering
- **THEN** no user account remains, and the invitation is still unredeemed

#### Scenario: The new member can work immediately
- **WHEN** a person registers with a valid `MANAGER` invitation
- **THEN** their very first authenticated request is accepted, with the manager's
  permissions

### Requirement: An invitation may be addressed to one person

An invitation MAY name an email address. When it does, it SHALL be redeemable only by a
registration using that address.

#### Scenario: Redeeming someone else's invitation
- **WHEN** a person registers with an address-bound invitation using a different address
- **THEN** the API responds 403 and no account is created
