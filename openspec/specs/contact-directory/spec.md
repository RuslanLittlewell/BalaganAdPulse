# contact-directory Specification

## Purpose
The contact directory gives authorized users one modal for browsing clients and employees and for managing the invitations that add either kind of contact.

## Requirements

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

### Requirement: An employee's reach is shown and changed where they are read

The employee directory SHALL show, for the person selected, the projects their grants
cover. An admin SHALL be able to add a project to them and remove one from there, and the
change SHALL take effect without leaving the directory.

Somebody who may not administer members SHALL see the projects listed and no control that
changes them.

#### Scenario: Seeing what somebody reaches

- **WHEN** an admin selects an employee in the directory
- **THEN** the projects that employee reaches are listed

#### Scenario: Granting a project

- **WHEN** an admin adds a project to an employee
- **THEN** the employee reaches it, and the list says so without the screen being reopened

#### Scenario: Removing a project

- **WHEN** an admin removes a project from an employee
- **THEN** the employee no longer reaches it

#### Scenario: Somebody who may not change them

- **WHEN** a member who may not administer members opens the directory
- **THEN** the projects are shown and nothing offers to change them

### Requirement: Outstanding invitations are listed where one is made

The list of invitations that have not been used SHALL live in the dialog that creates an
invitation, not under the directory. Opening that dialog SHALL show the ones outstanding
for the kind it creates, and revoking one SHALL be possible there.

The contact book SHALL keep a minimum height, so choosing between people does not resize
its panes.

An employee's own fields SHALL be laid out the way a client's are: one label and value to
a row, separated, so the two halves of the book read alike.

#### Scenario: Opening the invitation dialog

- **WHEN** a member opens the dialog that creates an invitation
- **THEN** the invitations of that kind which are still outstanding are listed in it

#### Scenario: The directory itself

- **WHEN** a member opens the contact book
- **THEN** no list of invitations appears under either directory

#### Scenario: Revoking from the dialog

- **WHEN** an admin revokes an outstanding invitation from the dialog
- **THEN** it disappears from the list

### Requirement: The employee directory leaves out the person reading it

The directory SHALL NOT list the member who is reading it. Nobody opens it to find
themselves, and their own row is the one whose grants an admin should not change in
passing while looking through everybody else's.

This SHALL be a property of that screen alone. Every place a person is *chosen* — being
made responsible for a task above all — SHALL continue to offer the reader, because
somebody taking a task themselves is the ordinary case.

#### Scenario: Opening the directory

- **WHEN** a member opens the employee directory
- **THEN** their colleagues are listed and they are not

#### Scenario: A directory of one

- **WHEN** the only member of the organization opens it
- **THEN** it says there is nobody to show rather than listing them

#### Scenario: Choosing a person elsewhere

- **WHEN** the same member opens the control that makes somebody responsible for a task
- **THEN** they are offered, alongside their colleagues

### Requirement: A project is shown as its picture and its name

Wherever the directory names a project — the list of what somebody reaches, and the
control that grants another — it SHALL show the project's picture beside its name, as
every other screen does.

Removing a granted project SHALL be a cross on that project's picture, and SHALL ask for
confirmation before it acts, naming the project it is about to remove.

#### Scenario: What somebody reaches

- **WHEN** an admin looks at an employee's granted projects
- **THEN** each is shown with its picture and its name

#### Scenario: Granting another

- **WHEN** an admin opens the control that adds a project
- **THEN** each project offered is shown with its picture and its name

#### Scenario: Removing one

- **WHEN** an admin presses the cross on a granted project
- **THEN** they are asked to confirm, the project is named in the question, and nothing
  changes until they agree

#### Scenario: Changing their mind

- **WHEN** an admin declines the confirmation
- **THEN** the grant is untouched

### Requirement: A client's people are listed to the client

A customer's contact book SHALL be their own company's people: who is on it, how to reach
each of them, which of them is the principal, and — for the principal — a way to invite
another.

The agency's client card SHALL hold the company's contact details alone. Its people are
not listed there: the card is about the company, and a second list beside the invitations
already on it said the same thing twice.

A client's people SHALL NOT appear in the employee directory, which is the agency's own.

#### Scenario: The agency looks at a client

- **WHEN** an admin opens a client in the contact book
- **THEN** the company's contact details are shown, and no list of its people

#### Scenario: A client's people are not the agency's

- **WHEN** an admin opens the employee directory
- **THEN** no customer appears there, whichever client they belong to

#### Scenario: The principal looks at their own company

- **WHEN** a `CLIENT_ADMIN` opens their company's people
- **THEN** they see who is on it, the invitations outstanding, and a way to invite another

#### Scenario: An ordinary customer looks at the same list

- **WHEN** a `CLIENT` opens it
- **THEN** they see who is on the company and no control that invites or removes anybody
