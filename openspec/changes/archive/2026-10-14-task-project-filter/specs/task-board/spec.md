## ADDED Requirements

### Requirement: The task module can be narrowed to chosen projects

The task module SHALL offer, next to the responsible-member filter, a filter by project choosing
any number of projects at once. Choosing none SHALL mean the module shows everything it otherwise
would; choosing one or more SHALL show only the tasks of those projects.

The filter SHALL list the projects of the tasks the member can already see, not every project of
the organization, so the list answers whose work is on this board. Each SHALL be shown by name
with its avatar. A Без проекта entry SHALL be offered while a task with no project is visible,
and choosing it SHALL include those tasks. A project that is chosen SHALL stay listed even when no
visible task belongs to it any more, so it can be unchosen.

The filter SHALL belong to the module rather than to one of its views: it SHALL narrow the board
and the calendar alike, and switching between them SHALL keep it. It SHALL combine with the
responsible-member filter, a task being shown only when it passes both. It SHALL narrow only what
reach and the own-work rule already allow, and SHALL NOT widen it.

The chosen projects SHALL be remembered for the member who chose them, survive leaving the module
and reloading the app, and SHALL NOT be shown to another member.

#### Scenario: Narrowing to one project

- **WHEN** a member whose board carries tasks of several projects chooses Сайт in the filter
- **THEN** only the tasks of Сайт are shown

#### Scenario: Narrowing to several projects

- **WHEN** the member chooses Магазин as well
- **THEN** the tasks of both projects are shown, and no others

#### Scenario: Choosing nothing shows everything

- **WHEN** no project is chosen in the filter
- **THEN** every task the member would otherwise see is shown

#### Scenario: The list names the projects on the board

- **WHEN** a member opens the filter
- **THEN** it lists, each with its avatar, the projects of the tasks that member can see, and
  no other project

#### Scenario: Tasks with no project

- **WHEN** a task with no project is visible and the member chooses Без проекта
- **THEN** the tasks with no project are shown

#### Scenario: Nothing without a project

- **WHEN** every visible task belongs to a project
- **THEN** the filter offers no Без проекта entry

#### Scenario: With a responsible member chosen

- **WHEN** a member chooses Сайт in the project filter and Мария in the responsible-member filter
- **THEN** only the tasks of Сайт that Мария is responsible for are shown

#### Scenario: The same filter on the calendar

- **WHEN** a member narrows the board to Сайт and switches to the calendar
- **THEN** the calendar shows the tasks of Сайт alone, with the filter still chosen

#### Scenario: The last task of a chosen project leaves

- **WHEN** the only visible task of a chosen project is deleted
- **THEN** the project is still listed and chosen, and can be unchosen

#### Scenario: The filter survives a reload

- **WHEN** a member chooses Сайт and reloads the app
- **THEN** Сайт is still chosen and the module is still narrowed to it

#### Scenario: Another member's own filter

- **WHEN** a second member opens the task module on the same browser
- **THEN** their project filter is their own, unaffected by what the first member chose
