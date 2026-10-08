## RENAMED Requirements

- FROM: `### Requirement: Members are administered through the API alone`
- TO: `### Requirement: Admins remove members from the contact book`

## MODIFIED Requirements

### Requirement: Admins remove members from the contact book

The web interface SHALL offer one place to look at the organization's members — the
contact book's employee directory. For an `ADMIN` it SHALL offer a control that removes
the member shown from the organization, after a confirmation naming that member. It SHALL
NOT offer a control that changes a member's role or status, and SHALL offer no control at
all to any other role.

The API SHALL continue to accept role, status and removal changes, with the rules it
already enforces unchanged: only an admin may make them, an admin may not remove their own
membership, and the last admin may not be removed.

An address that named the removed Team section SHALL lead somewhere useful rather than to
a blank screen.

#### Scenario: Looking at the members

- **WHEN** a member opens the contact book's employee pane
- **THEN** each member is shown with their name, email and role, and no control changes
  their role or status

#### Scenario: Admin removes a member

- **WHEN** an admin chooses remove on an employee's card and confirms
- **THEN** the membership is removed and the person disappears from the directory

#### Scenario: Removal refused

- **WHEN** the API refuses the removal
- **THEN** the admin is told it failed and the person stays in the directory

#### Scenario: Manager sees no remove control

- **WHEN** a manager opens an employee's card
- **THEN** no remove control is offered

#### Scenario: No navigation entry

- **WHEN** any member looks at the main navigation
- **THEN** it offers no Team section, whatever their role

#### Scenario: An address that named the removed section

- **WHEN** someone opens `/team` from a bookmark
- **THEN** they are taken to the dashboard

#### Scenario: The rules are unchanged

- **WHEN** an admin changes a member's role through the API
- **THEN** it is accepted exactly as before, and the same refusals apply
