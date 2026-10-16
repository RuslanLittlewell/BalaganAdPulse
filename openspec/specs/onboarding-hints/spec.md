# onboarding-hints Specification

## Purpose
Onboarding hints point a person at the control they need next, and stay out of the way once
they have been read and closed.

## Requirements

### Requirement: A hint stays until it is closed

A hint SHALL appear next to the control it points at and SHALL stay visible until the person
closes it with its own close button. Clicking elsewhere or pressing Escape SHALL NOT close
it, and it SHALL NOT take the focus. Once closed, the hint SHALL NOT appear again for that
person in that browser.

#### Scenario: Closing a hint
- **WHEN** the person presses the hint's close button
- **THEN** the hint disappears and does not come back after a reload

#### Scenario: Clicking elsewhere
- **WHEN** the person clicks somewhere else on the page while a hint is shown
- **THEN** the hint stays

#### Scenario: Another person in the same browser
- **WHEN** a different person signs in after the first closed a hint
- **THEN** that person still sees the hint when it applies to them

### Requirement: A new organization's admin is pointed to the contact book

While an organization has no clients and no employees other than the signed-in admin, the
contact book button in the header SHALL carry the hint "Добавить клиентов и сотрудников".
It SHALL be shown only to an organization `ADMIN`, SHALL be hidden while the contact book
is open, and SHALL no longer be shown once the organization has a client or another
employee.

#### Scenario: A fresh organization
- **WHEN** the first admin of an organization with no clients and no other employees opens
  the app
- **THEN** the contact book button carries the hint

#### Scenario: An organization with people
- **WHEN** the organization has a client or an employee besides the admin
- **THEN** no hint is shown

#### Scenario: Another role
- **WHEN** a manager, guest or customer opens the app of a fresh organization
- **THEN** no hint is shown

### Requirement: An empty client list points at the add button

While the organization has no clients, the contact book's add-client button SHALL carry the
hint "Создайте клиента", above the button, for anyone who may create a client. The hint SHALL show above the
open contact book, SHALL be hidden while a client is being created, and SHALL no longer be
shown once a client exists. Closing it SHALL be remembered on its own, apart from any other
hint.

#### Scenario: An empty client list
- **WHEN** an admin or a manager opens the contact book of an organization with no clients
- **THEN** the add-client button carries the hint

#### Scenario: Clients exist
- **WHEN** the organization has a client
- **THEN** no hint is shown on the add-client button

#### Scenario: Someone who may not create clients
- **WHEN** a guest opens the contact book of an organization with no clients
- **THEN** no hint is shown

#### Scenario: Closing it
- **WHEN** the person closes the hint and opens the contact book again
- **THEN** the hint does not return, while the header hint is unaffected

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
