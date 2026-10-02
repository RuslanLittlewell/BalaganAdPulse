## MODIFIED Requirements

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
- **THEN** they can change its name and picture, and are offered no deletion and no priority choice

### Requirement: A project's figures are stated in a named currency

A project SHALL carry the currency its measured figures are stated in, as an ISO 4217 code,
and that currency SHALL come from the advertising integration that supplies the figures —
never from a member. Spend and every figure derived from it SHALL be shown in that currency
rather than in a fixed one, so two projects billed differently are never added up as though
they were the same money.

A project SHALL have no currency until an integration supplies one. Creating or editing a
project SHALL NOT accept a currency; a currency named in such a request SHALL be ignored.
The project form and the client registration form SHALL offer no currency choice.

#### Scenario: Creating a project

- **WHEN** a member creates a project
- **THEN** it is stored without a currency, and the project reads back with none

#### Scenario: Creating a project without naming a currency

- **WHEN** a member creates a project naming no currency
- **THEN** the project is stored without a currency

#### Scenario: Changing the currency

- **WHEN** a member sends a currency while editing a project
- **THEN** the currency is ignored and the project's currency is unchanged

#### Scenario: An unknown currency

- **WHEN** a request names any currency, known or not
- **THEN** the currency is ignored and the request is otherwise handled as usual

#### Scenario: Showing a project's figures

- **WHEN** a project's measured figures are shown
- **THEN** each amount appears in that project's own currency, not in a fixed one

#### Scenario: A project with no currency yet

- **WHEN** the figures of a project without a currency are shown
- **THEN** amounts appear without a currency sign

#### Scenario: No currency choice in the forms

- **WHEN** a member opens the project form or a client opens the registration form
- **THEN** no currency field is offered
