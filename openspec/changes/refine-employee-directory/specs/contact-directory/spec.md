## ADDED Requirements

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
