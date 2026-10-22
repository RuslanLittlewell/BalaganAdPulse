## ADDED Requirements

### Requirement: The dashboard gauge separates the zones

The dashboard's monthly KPI gauge SHALL count every project in one of four groups by its
progress for the month so far: meets the plan at 90% or more, a little behind from 70% up to
90%, far behind below 70%, and unrated when it has no KPI or its figure is not measured. The
groups SHALL be drawn in that order along the arc in green, yellow, red and grey, and each SHALL
be listed with its count.

#### Scenario: A project a little behind
- **WHEN** a project has 24 leads against a month-to-date KPI of 30
- **THEN** it is counted as a little behind and drawn yellow

#### Scenario: A project far behind
- **WHEN** a project has 20 leads against a month-to-date KPI of 30
- **THEN** it is counted as far behind and drawn red

#### Scenario: Unrated projects
- **WHEN** a project has no KPI
- **THEN** it is counted as unrated

### Requirement: The dashboard project table shows KPI progress

Each project row in the dashboard's project table SHALL carry a mark beside its name coloured
by the project's progress against its KPI for the selected period, in the zones of the project
list, and exposed to assistive technology in words. The table SHALL offer a Выполнение KPI
column with that progress in percent, visible until a member hides it, and a dash for a
project with no KPI or no measured figure. The column SHALL be sortable like the others, with
projects without a value always last.

#### Scenario: A project on plan
- **WHEN** a project's progress is 95%
- **THEN** its row carries a green mark and its Выполнение KPI cell shows 95%

#### Scenario: A project a little behind
- **WHEN** a project's progress is 80%
- **THEN** its row carries a yellow mark

#### Scenario: A project without a KPI
- **WHEN** a project has no KPI
- **THEN** its row carries a grey mark and its Выполнение KPI cell shows a dash

#### Scenario: Sorting by progress
- **WHEN** a member chooses the Выполнение KPI header
- **THEN** the projects are ordered from the highest progress to the lowest, projects
  without a value last, and choosing it again reverses the order
