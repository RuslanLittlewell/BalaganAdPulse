## ADDED Requirements

### Requirement: The responsible member is picked from the agency staff

The task form's responsible-member picker SHALL offer every active admin, manager and guest
of the organization, including the member filling the form, to an admin and to a manager
alike. It SHALL NOT offer a customer or a suspended member. A task whose responsible member
is no longer offered SHALL still show that member as selected.

#### Scenario: Manager assigns a task to themselves
- **WHEN** a manager creates a task and picks themselves as responsible
- **THEN** the task is stored with the manager as its responsible member

#### Scenario: Manager assigns a task to an admin
- **WHEN** a manager opens the responsible-member picker
- **THEN** it offers themselves, the other employees and the admins of the organization

#### Scenario: Suspended members are not offered
- **WHEN** a member opens the responsible-member picker and a colleague is suspended
- **THEN** that colleague is not offered
