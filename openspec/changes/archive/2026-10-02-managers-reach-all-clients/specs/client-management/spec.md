## REMOVED Requirements

### Requirement: Creating a client grants its creator access
**Reason**: Managers now reach every client of their organization, so a client one manager
creates is no longer invisible to another; the creator's grant now matters for project
reach only.
**Migration**: Replaced by "A new client is visible to every manager"; existing grants keep
their meaning.

## ADDED Requirements

### Requirement: A new client is visible to every manager

Creating a client SHALL give the member who created it reach over that client and all its
projects, unless their role already reaches the whole organization. A member SHALL NOT be
able to create a client they cannot then see. Every manager of the organization SHALL see
a new client regardless of who created it.

#### Scenario: A manager creates a client
- **WHEN** a manager creates a client
- **THEN** the client appears in their own list, they can read and edit it, and they
  reach the projects later created under it

#### Scenario: An admin creates a client
- **WHEN** an admin creates a client
- **THEN** no grant is recorded for them, because their role already reaches every client
  of the organization, and the client appears in every manager's list

#### Scenario: One manager's new client is visible to another
- **WHEN** two managers each create a client
- **THEN** each sees both clients, and each reaches the projects only of their own
