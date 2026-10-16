## ADDED Requirements

### Requirement: A project carries no priority

A project SHALL NOT carry a priority. Reading a project SHALL return no priority, and a
priority sent when creating or updating a project SHALL be ignored rather than stored or
refused.

#### Scenario: Reading a project

- **WHEN** a member lists or reads projects
- **THEN** no project in the response has a priority

#### Scenario: A priority sent by an older client

- **WHEN** an admin updates a project's name and sends a priority alongside it
- **THEN** the API responds 200, the name is stored and the response has no priority

## MODIFIED Requirements

### Requirement: Customers create and edit their own client's projects
The projects module SHALL offer customers the control to create a project and the action to edit a project of their client. The project form SHALL fix the client to the customer's own client and SHALL NOT offer choosing another client, creating a client or deleting the project. A project created by a customer SHALL appear, without further action, wherever the agency's members who reach that client see projects.

#### Scenario: A client adds a project
- **WHEN** a client opens the projects module, activates the create control, enters a name and creates it
- **THEN** the project opens for them, belongs to their client, and an agency admin sees it in their projects list

#### Scenario: The client field for a customer
- **WHEN** a client opens the project form
- **THEN** their own client is selected and cannot be changed, and no Новый клиент control is offered

#### Scenario: Editing without agency controls
- **WHEN** a client edits their client's project
- **THEN** they can change its name and picture, and are offered no deletion
