# project-management Specification

## Purpose

A project is the unit of work the agency runs for one client, and the object most of the
interface hangs on: it carries the currency its figures are stated in and the priority, and
it is what campaigns, their daily figures and the board's tasks belong to.

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
The projects module SHALL offer customers the control to create a project and the action to edit a project of their client. The project form SHALL fix the client to the customer's own client and SHALL NOT offer choosing another client, creating a client or deleting the project. The priority menu SHALL NOT be offered to customers. A project created by a customer SHALL appear, without further action, wherever the agency's members who reach that client see projects, with the priority every new project starts with.

#### Scenario: A client adds a project
- **WHEN** a client opens the projects module, activates the create control, enters a name and creates it
- **THEN** the project opens for them, belongs to their client, and an agency admin sees it in their projects list

#### Scenario: The client field for a customer
- **WHEN** a client opens the project form
- **THEN** their own client is selected and cannot be changed, and no Новый клиент control is offered

#### Scenario: Editing without agency controls
- **WHEN** a client edits their client's project
- **THEN** they can change its name, currency and picture, and are offered no deletion and no priority choice

### Requirement: Staff can be assigned to a project as it is created
Creating a project SHALL accept an optional list of employees to assign. Each assigned employee SHALL be granted access to that project alone, in the same operation that creates it, so that they reach the project as soon as it exists. An employee SHALL be an active manager or guest of the creator's organization. Only a member who may manage members' access SHALL name employees; for anyone else a non-empty list SHALL be refused with 403. A list naming anyone who is not an eligible employee SHALL be refused with 400. When creation is refused, neither the project nor any grant SHALL be stored. An omitted or empty list SHALL leave project creation as it is.

The project form SHALL offer, when creating a project and only to members who may manage access, a Сотрудники picker listing the organization's active managers and guests, allowing several to be chosen. Editing a project SHALL NOT offer it.

#### Scenario: An admin staffs a new project
- **WHEN** an admin creates a project naming two managers
- **THEN** the project is stored and each manager, listing projects, sees it

#### Scenario: The grant covers that project alone
- **WHEN** an admin creates a project for a client with other projects, naming a manager who held no access to that client
- **THEN** the manager reaches the new project and none of the client's other projects

#### Scenario: A manager names an employee
- **WHEN** a manager creates a project naming another manager
- **THEN** the API responds 403 and nothing is stored

#### Scenario: An ineligible member is named
- **WHEN** an admin creates a project naming an admin, a client, a suspended manager or a member of another organization
- **THEN** the API responds 400 and neither the project nor any grant is stored

#### Scenario: Nobody is named
- **WHEN** a manager or a client creates a project without naming employees
- **THEN** the project is created as before and no grant is stored

#### Scenario: Choosing employees in the form
- **WHEN** an admin opens the new-project form, chooses two employees in Сотрудники and creates the project
- **THEN** the request names exactly those two employees

#### Scenario: The picker is withheld
- **WHEN** a manager or a client opens the new-project form, or an admin edits an existing project
- **THEN** no Сотрудники picker is offered

### Requirement: A project's figures are stated in a named currency

A project SHALL carry the currency its measured figures are stated in: `BYN`, `RUB`, `USD`
or `EUR`. Spend and every figure derived from it SHALL be shown in that currency rather than
in a fixed one, so two projects billed differently are never added up as though they were
the same money.

Every project SHALL carry a currency, whether or not any figures have been measured yet.
New projects SHALL default to `BYN`.

Currency SHALL NOT be inferred from anything else — not the client, not the locale. It is
what the agency and the client agreed, and only they know it.

#### Scenario: Creating a project

- **WHEN** a member creates a project naming a currency
- **THEN** it is stored, and the project reads back with it

#### Scenario: Creating a project without naming a currency

- **WHEN** a member creates a project naming no currency
- **THEN** the project is stored with the default currency

#### Scenario: Changing the currency

- **WHEN** a member changes a project's currency
- **THEN** the new currency is stored and the project's other fields are unchanged

#### Scenario: An unknown currency

- **WHEN** a request names a currency outside the four
- **THEN** the API responds 400 and the project is unchanged

#### Scenario: Showing a project's figures

- **WHEN** a project's measured figures are shown
- **THEN** each amount appears in that project's own currency, not in a fixed one
