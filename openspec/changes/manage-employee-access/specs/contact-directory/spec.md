## ADDED Requirements

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
