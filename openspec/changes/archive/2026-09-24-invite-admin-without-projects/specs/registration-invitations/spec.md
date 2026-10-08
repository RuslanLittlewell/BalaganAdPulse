## MODIFIED Requirements

### Requirement: Every invitation has a registration type

An invitation SHALL have exactly one registration type: `CLIENT` or `EMPLOYEE`. An employee invitation SHALL carry one of the employee roles `ADMIN`, `MANAGER`, or `GUEST`. A `MANAGER` or `GUEST` invitation SHALL carry one or more project identifiers; an `ADMIN` invitation SHALL carry none, since an admin reaches the whole organization. A client invitation SHALL carry neither a role nor projects.

The invitation dialog SHALL offer the project picker only while the chosen role is a manager or a guest, and SHALL send an admin invitation without projects.

#### Scenario: Valid employee invitation input
- **WHEN** an authorized actor creates a `MANAGER` or `GUEST` invitation with projects in their organization
- **THEN** the invitation is stored with that role and those projects

#### Scenario: Admin invitation without projects
- **WHEN** an admin creates an `ADMIN` invitation naming no projects
- **THEN** the invitation is stored with the admin role and no projects, and redeeming it enrols an admin holding no access grants

#### Scenario: Admin invitation naming projects
- **WHEN** a caller creates an `ADMIN` invitation with project identifiers
- **THEN** the API responds 400 and stores no invitation

#### Scenario: Manager or guest invitation without projects
- **WHEN** a caller creates a `MANAGER` or `GUEST` invitation naming no projects
- **THEN** the API responds 400 and stores no invitation

#### Scenario: Employee project from another organization
- **WHEN** an actor includes a project outside their organization
- **THEN** the API responds 400 and stores no invitation

#### Scenario: Client invitation includes employee fields
- **WHEN** a caller creates a `CLIENT` invitation with a role or project identifiers
- **THEN** the API responds 400 and stores no invitation

#### Scenario: Employee invitation requests the client role
- **WHEN** a caller creates an `EMPLOYEE` invitation with role `CLIENT`
- **THEN** the API responds 400 and stores no invitation

#### Scenario: The dialog for an admin
- **WHEN** an admin chooses Администратор in the employee invitation dialog and creates the invitation
- **THEN** no project picker is shown, no project is demanded, and the request names no projects
