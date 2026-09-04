## ADDED Requirements

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
