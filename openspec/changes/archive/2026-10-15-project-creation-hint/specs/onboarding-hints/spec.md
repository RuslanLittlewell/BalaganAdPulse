## ADDED Requirements

### Requirement: An empty project list points at the add button

While the person reaches no projects, the projects module's add-project button SHALL carry
the hint "Создайте проект", above the button, for anyone who may create a project. It SHALL
be hidden while a project is being created, SHALL no longer be shown once a project exists,
and closing it SHALL be remembered on its own, apart from any other hint.

#### Scenario: An empty project list
- **WHEN** an admin opens the projects module with no projects
- **THEN** the add-project button carries the hint

#### Scenario: Projects exist
- **WHEN** there is a project
- **THEN** no hint is shown on the add-project button

#### Scenario: Someone who may not create projects
- **WHEN** a guest opens the projects module with no projects
- **THEN** no hint is shown

#### Scenario: Closing it
- **WHEN** the person closes the hint
- **THEN** it does not return, and the other hints are unaffected

### Requirement: The new-project dialog points at adding a client

While there are no clients, the new-project dialog's add-client button SHALL carry the hint
"Добавьте клиента", above the button, for anyone who may create a client. It SHALL be hidden
while a client is being created from the dialog, SHALL no longer be shown once a client
exists, and closing it SHALL be remembered on its own, apart from any other hint.

#### Scenario: No clients yet
- **WHEN** an admin opens the new-project dialog with no clients
- **THEN** the add-client button carries the hint

#### Scenario: Clients exist
- **WHEN** there is a client
- **THEN** no hint is shown on the add-client button

#### Scenario: Creating the client
- **WHEN** the person opens the client form from the dialog
- **THEN** the hint is hidden
