## ADDED Requirements

### Requirement: A person's picture follows the roster

A member's picture SHALL be served to every member the online roster would disclose that
person to, whatever their role, and to nobody else. A member it is not served to SHALL get
the same 404 as for a member who does not exist.

#### Scenario: A manager sees a colleague's picture
- **WHEN** a manager requests the picture of an admin of their organization
- **THEN** the picture is returned

#### Scenario: A customer sees the agency's picture
- **WHEN** a customer requests the picture of a manager of the agency
- **THEN** the picture is returned

#### Scenario: A customer of another client
- **WHEN** a customer requests the picture of a customer who shares none of their clients
- **THEN** the API responds 404

#### Scenario: Another organization
- **WHEN** any member requests the picture of a member of another organization
- **THEN** the API responds 404
