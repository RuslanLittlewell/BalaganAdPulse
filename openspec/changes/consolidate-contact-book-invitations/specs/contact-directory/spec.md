## Purpose

The contact directory gives authorized users one modal for browsing clients and employees and for managing the invitations that add either kind of contact.

## ADDED Requirements

### Requirement: The contact book switches between clients and employees

The contact-book modal SHALL display a selector above its lists with `Clients` and `Employees` options, and SHALL show only the directory selected by the user.

#### Scenario: Opening the contact book
- **WHEN** a user opens the contact-book modal
- **THEN** the selector and the client directory are displayed

#### Scenario: Selecting employees
- **WHEN** the user selects `Employees`
- **THEN** the modal displays the organization's employee list instead of the client list

### Requirement: Invitation management lives in the contact book

The contact-book modal SHALL provide invitation creation and the pending invitation list for the selected contact type when the actor has the corresponding invitation permissions. The Team page SHALL NOT expose a second invitation panel.

#### Scenario: Admin selects employees
- **WHEN** an admin selects `Employees` in the contact book
- **THEN** the modal offers an employee-invitation action and lists pending employee invitations

#### Scenario: Admin selects clients
- **WHEN** an admin selects `Clients` in the contact book
- **THEN** the modal offers a client-invitation action and lists pending client invitations

#### Scenario: Invitation permissions are absent
- **WHEN** a user without invitation-management permission opens either directory
- **THEN** invitation creation and revocation controls are absent

### Requirement: Employee invitations collect role and projects

The employee-invitation form SHALL require one role and at least one project selected through a multi-select control. The available projects SHALL be limited to projects in the actor's organization.

#### Scenario: Creating an employee invitation
- **WHEN** an authorized actor selects a role and multiple projects and submits the form
- **THEN** one employee invitation is created carrying exactly that role and those projects

#### Scenario: No project selected
- **WHEN** an actor submits an employee invitation without selecting a project
- **THEN** the form refuses submission and no invitation is created

### Requirement: Client invitations need no onboarding details yet

The client-invitation form SHALL create a client registration link without asking for an employee role or projects.

#### Scenario: Creating a client invitation
- **WHEN** an authorized actor submits the client-invitation form
- **THEN** a pending client invitation and its client-registration link are displayed

### Requirement: Invitation links are copyable

Every pending invitation row and newly created invitation result SHALL display the backend-provided registration link and provide an action that copies that link.

#### Scenario: Copying a pending employee invitation
- **WHEN** an admin copies an employee invitation from the contact book
- **THEN** the clipboard receives its `/regustration/{code}` link rather than the bare code

