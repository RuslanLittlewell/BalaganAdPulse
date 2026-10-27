## MODIFIED Requirements

### Requirement: The employee directory leaves out the person reading it

The directory SHALL NOT list the member who is reading it. Nobody opens it to find
themselves, and their own row is the one whose grants an admin should not change in
passing while looking through everybody else's.

This SHALL be a property of that screen alone. Every place a person is *chosen* — being
named on a task above all — SHALL continue to offer the reader, because somebody taking
part in their own work is the ordinary case.

#### Scenario: Opening the directory

- **WHEN** a member opens the employee directory
- **THEN** their colleagues are listed and they are not

#### Scenario: A directory of one

- **WHEN** the only member of the organization opens it
- **THEN** it says there is nobody to show rather than listing them

#### Scenario: Choosing a person elsewhere

- **WHEN** the same member opens the control that names a task's participants
- **THEN** they are offered, alongside their colleagues
