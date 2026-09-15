# project-management Specification

## Purpose

A project is the unit of work the agency runs for one client, and the object most of the
interface hangs on: it carries the niche, the monthly budget and the priority, and it is
what campaigns, their daily figures and the board's tasks belong to.

## Requirements

### Requirement: A monthly budget is an amount in a named currency

A project's monthly budget SHALL carry the currency it is stated in: `BYN`, `RUB`, `USD`
or `EUR`. A budget SHALL NOT be stored as a bare number, and wherever one is shown it
SHALL be shown with its currency.

A project with no budget SHALL still carry a currency, so that entering an amount later
does not also require choosing one. New projects SHALL default to `BYN`.

Currency SHALL NOT be inferred from anything else — not the client, not the locale. It is
what the agency and the client agreed, and only they know it.

#### Scenario: Creating a project with a budget

- **WHEN** a member creates a project with a monthly budget and a currency
- **THEN** both are stored, and the project reads back with them

#### Scenario: Creating a project without a budget

- **WHEN** a member creates a project naming no budget
- **THEN** the project is stored with no amount and the default currency

#### Scenario: Changing the currency alone

- **WHEN** a member changes a project's currency without touching the amount
- **THEN** the amount is unchanged and the new currency is stored

#### Scenario: An unknown currency

- **WHEN** a request names a currency outside the four
- **THEN** the API responds 400 and the project is unchanged

#### Scenario: Showing a budget

- **WHEN** a project with a budget is shown
- **THEN** the amount appears with its own currency, not with a fixed one

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
- **THEN** they can change its name, niche, budget, currency and picture, and are offered no deletion and no priority choice
