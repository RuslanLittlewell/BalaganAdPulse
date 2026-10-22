# project-management Specification

## Purpose

A project is the unit of work the agency runs for one client, and the object most of the
interface hangs on: it carries the currency its figures are stated in and its KPI, and it is
what campaigns, their daily figures and the board's tasks belong to.

## Requirements

### Requirement: A client can be created from the project form
The project form SHALL offer, beside its client select and to members who may create clients, a control named Новый клиент that opens the new-client form without closing the project form. A client created there SHALL be added to the organization's clients, appear in the contact book and in the client select, and become the selected client of the project form. Cancelling the new-client form SHALL leave the project form and its selected client unchanged. Members who may not create clients SHALL NOT be offered the control.

#### Scenario: Create and select a client
- **WHEN** a manager creating a project activates Новый клиент, enters a client name and creates it
- **THEN** the new-client form closes, the project form shows the new client as selected, and creating the project assigns it to that client

#### Scenario: Cancel
- **WHEN** a manager opens Новый клиент from the project form and cancels
- **THEN** the project form keeps its previously selected client

#### Scenario: The contact book shows the new client
- **WHEN** a client was created from the project form
- **THEN** the contact book lists it without a reload

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

### Requirement: A manager reaches the projects they create
A manager SHALL be able to create a project whatever grants they hold, including none. The project SHALL belong to the manager's organization — the agency that enrolled them — under a client that organization holds, and every admin of that organization SHALL see it. Creating it SHALL grant the creating manager access to that project in the same operation, so they reach it as soon as it exists, even when they reached its client only through a grant naming another project. When creation is refused, neither the project nor the grant SHALL be stored. A manager holding no client SHALL create one from the project form, as a client created by a manager is already reachable by them.

#### Scenario: A manager without projects starts one
- **WHEN** a manager enrolled without projects creates a client from the project form and then a project for it
- **THEN** the project is stored in their organization, opens for them, and an admin of that organization sees it in their projects list

#### Scenario: A manager reaching a client through one project
- **WHEN** a manager whose only grant names project A1 of client A creates project A2 for client A
- **THEN** A2 is stored, the manager reaches both A1 and A2, and still reaches no other project of client A

#### Scenario: Another agency
- **WHEN** a manager creates a project naming a client of another organization
- **THEN** the API responds 404 and nothing is stored

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

### Requirement: Selects that offer projects can be searched

Every select that offers the projects to choose from SHALL show a search field at the top of its
list. The field SHALL be focused when the list opens and SHALL narrow the options to those whose
name contains the typed text, ignoring case and surrounding spaces. Options that stand for
no particular project, such as All projects, SHALL be left out while the member searches. Enter
SHALL choose the first matching option, and a search matching nothing SHALL say so. The search
SHALL be empty each time the list opens.

#### Scenario: Narrowing the options
- **WHEN** a member opens the report filter and types ром
- **THEN** only the projects whose name contains ром are listed

#### Scenario: Choosing the first match
- **WHEN** the member presses Enter after typing
- **THEN** the first matching project is chosen and the list closes

#### Scenario: Nothing matches
- **WHEN** the member types text that no project name contains
- **THEN** the list says that nothing was found and Enter chooses nothing

#### Scenario: A fresh search
- **WHEN** the member closes the list with a query typed and opens it again
- **THEN** the search field is empty and every option is listed
