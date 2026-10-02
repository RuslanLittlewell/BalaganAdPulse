## ADDED Requirements

### Requirement: The task module can be narrowed to chosen responsible members

The task module SHALL offer a filter by responsible member, choosing any number of them at
once. Choosing none SHALL mean the module shows everything it otherwise would; choosing one
or more SHALL show only the tasks those members are responsible for.

The filter SHALL list the members who are responsible for the tasks the viewer can already
see, not the organization's staff, so the list answers whose work is on this board. Each
SHALL be shown by name with their avatar. An **Не назначен** entry SHALL be offered
alongside them while a task nobody is responsible for is visible, and choosing it SHALL
include those tasks.

The filter SHALL narrow only what reach and the own-work rule already allow, and SHALL NOT
widen it: it is a reading aid, never a way to see somebody else's work.

The filter SHALL belong to the module rather than to one of its views: it SHALL narrow the
board and the calendar alike, and switching between them SHALL keep it.

#### Scenario: Narrowing to one member

- **WHEN** an admin whose board carries several members' tasks chooses one member in the
  filter
- **THEN** only the tasks that member is responsible for are shown

#### Scenario: Narrowing to several members

- **WHEN** the admin chooses a second member as well
- **THEN** the tasks of both members are shown, and no others

#### Scenario: Choosing nobody shows everything

- **WHEN** no member is chosen in the filter
- **THEN** every task the member would otherwise see is shown

#### Scenario: Unchoosing the last member

- **WHEN** the admin unchooses the only member they had chosen
- **THEN** the module shows everything again, as it did before the filter was touched

#### Scenario: The list names whose work is on the board

- **WHEN** a member opens the filter
- **THEN** it lists, each with their avatar, the members responsible for the tasks that
  member can see, and nobody else

#### Scenario: Work nobody is responsible for

- **WHEN** a task nobody is responsible for is visible and the member chooses **Не назначен**
- **THEN** the tasks with no responsible member are shown

#### Scenario: Nothing to claim

- **WHEN** every visible task has somebody responsible for it
- **THEN** the filter offers no **Не назначен** entry

#### Scenario: The filter cannot widen what is seen

- **WHEN** a manager, who sees only the tasks they are responsible for, uses the filter
- **THEN** no colleague's task appears, whatever is chosen

#### Scenario: The same filter on the calendar

- **WHEN** a member narrows the board to one responsible member and switches to the calendar
- **THEN** the calendar shows that member's tasks alone, with the filter still chosen

### Requirement: The task module remembers whose work was chosen

The chosen responsible members SHALL be remembered for the member who chose them and SHALL
survive leaving the module and reloading the app, the way the chosen view already does. Each
member SHALL have their own choice: one member's filter SHALL NOT be shown to another.

#### Scenario: The filter outlives the visit

- **WHEN** a member narrows the module to one responsible member, leaves the module and
  opens it again
- **THEN** the same member is still chosen and the module is still narrowed to their work

#### Scenario: The filter survives a reload

- **WHEN** a member narrows the module and reloads the app
- **THEN** the filter is as they left it

#### Scenario: Another member's own filter

- **WHEN** a second member opens the task module on the same browser
- **THEN** their filter is their own, unaffected by what the first member chose
