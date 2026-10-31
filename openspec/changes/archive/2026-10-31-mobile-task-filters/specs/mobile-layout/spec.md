## ADDED Requirements

### Requirement: A narrow screen keeps the task filters behind a button
Below 768 pixels of width, the task module and the archive SHALL show a button with a filter icon
in place of the participant and project filters; the button SHALL open both filters, which SHALL
narrow the list as they do inline. While any participant or project is chosen, the button SHALL
show how many choices are active, visibly and in its accessible name. From 768 pixels of width,
the filters SHALL stay inline in the header without the button.

#### Scenario: Opening the filters on a phone
- **WHEN** a member on a screen 390 pixels wide presses the filter button in the task module
- **THEN** the participant and project filters open, and choosing a project there narrows the tasks to it

#### Scenario: Active filters on a phone
- **WHEN** a member who chose one participant and one project opens the task module on a phone
- **THEN** the filter button shows that two choices are active

#### Scenario: Filters on a wide screen
- **WHEN** a member opens the task module on a screen 1280 pixels wide
- **THEN** the participant and project filters are in the header and no filter button is shown
