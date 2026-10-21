## MODIFIED Requirements

### Requirement: Staff can be assigned to a project as it is created
Creating a project SHALL accept an optional list of participants to assign. Each assigned participant SHALL be granted access to that project alone, in the same operation that creates it, so that they reach the project as soon as it exists. A participant SHALL be an active admin, manager or guest of the creator's organization. Only a member who may manage members' access SHALL name participants; for anyone else a non-empty list SHALL be refused with 403. A list naming anyone who is not an eligible participant SHALL be refused with 400. When creation is refused, neither the project nor any grant SHALL be stored. An omitted or empty list SHALL leave project creation as it is.

The project form SHALL offer, when creating a project and only to members who may manage access, an Участники picker listing the organization's active admins, managers and guests, allowing several to be chosen. Every active admin SHALL be chosen until the creator changes the choice. Editing a project SHALL NOT offer it.

#### Scenario: An admin staffs a new project
- **WHEN** an admin creates a project naming two managers
- **THEN** the project is stored and each manager, listing projects, sees it

#### Scenario: The grant covers that project alone
- **WHEN** an admin creates a project for a client with other projects, naming a manager who held no access to that client
- **THEN** the manager reaches the new project and none of the client's other projects

#### Scenario: A manager names an employee
- **WHEN** a manager creates a project naming another manager
- **THEN** the API responds 403 and nothing is stored

#### Scenario: An admin is named
- **WHEN** an admin creates a project naming themselves and a manager
- **THEN** the project is stored and both reach it

#### Scenario: An ineligible member is named
- **WHEN** an admin creates a project naming a client, a suspended manager or a member of another organization
- **THEN** the API responds 400 and neither the project nor any grant is stored

#### Scenario: Nobody is named
- **WHEN** an admin or a client creates a project without naming employees
- **THEN** the project is created as before and no grant is stored

#### Scenario: Admins are chosen by default
- **WHEN** an admin opens the new-project form
- **THEN** every active admin is listed in Участники and chosen

#### Scenario: Choosing employees in the form
- **WHEN** an admin opens the new-project form, unchooses an admin, chooses a manager in Участники and creates the project
- **THEN** the request names exactly the admins still chosen and that manager

#### Scenario: The picker is withheld
- **WHEN** a manager or a client opens the new-project form, or an admin edits an existing project
- **THEN** no Участники picker is offered
