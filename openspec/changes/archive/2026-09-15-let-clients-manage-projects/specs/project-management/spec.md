## ADDED Requirements

### Requirement: Customers create and edit their own client's projects
The projects module SHALL offer customers the control to create a project and the action to edit a project of their client. The project form SHALL fix the client to the customer's own client and SHALL NOT offer choosing another client, creating a client or deleting the project. The priority menu SHALL NOT be offered to customers. A project created by a customer SHALL appear, without further action, wherever the agency's members who reach that client see projects, with the priority every new project starts with.

#### Scenario: A client adds a project
- **WHEN** a client opens the projects module, activates the create control, enters a name and creates it
- **THEN** the project opens for them, belongs to their client, and an agency admin sees it in their projects list

#### Scenario: The client field for a customer
- **WHEN** a client opens the project form
- **THEN** their own client is selected and cannot be changed, and no Новый клиент control is offered

#### Scenario: Editing without agency controls
- **WHEN** a client edits their client's project
- **THEN** they can change its name, niche, budget, currency and picture, and are offered no deletion and no priority choice
