## Purpose

Show on the dashboard how the projects a member reaches stand against their KPIs this month,
and point out the projects that have no KPI to stand against.

## ADDED Requirements

### Requirement: The dashboard gauges this month's KPI performance

The dashboard SHALL show a gauge titled Выполнение KPI за месяц over every project the member
reaches. It SHALL judge each project by its own KPI over the current month, from the first
day of the month to today, whatever period the dashboard has selected, prorating monthly
targets and rounding progress as the project's marker in the project list does. Each
project SHALL count as:

- met when its progress is 90% or more;
- behind when its progress is below 90%;
- unrated when it has no KPI or the KPI's figure is not measured for the month.

The gauge's arc SHALL be divided in proportion to these counts: green for met, then red for
behind, then grey for unrated. A needle SHALL point at the end of the green part. Under the
arc the gauge SHALL read the number of met projects out of all projects, as "7 из 12", and a
legend SHALL name each part with its count: Выполняют, Не выполняют and Без оценки. The gauge
SHALL expose these counts to assistive technology rather than through colour alone. It SHALL
follow a change of a project's KPI or figures without a reload. With no projects, the arc
SHALL be grey and the gauge SHALL read —.

#### Scenario: Counting projects

- **WHEN** a member reaches 12 projects, of which 7 meet their KPI this month, 3 are behind
  and 2 have no KPI
- **THEN** the gauge reads 7 из 12 and its legend gives Выполняют 7, Не выполняют 3 and
  Без оценки 2

#### Scenario: A monthly target is prorated

- **WHEN** on 15 October a project with a KPI of 62 leads a month has 30 leads since
  1 October
- **THEN** its target for the month so far is 30 and it counts as met

#### Scenario: Somewhat behind is behind

- **WHEN** a project's progress this month is 90%
- **THEN** it counts as behind, although its marker in the project list is yellow

#### Scenario: The period does not move the gauge

- **WHEN** a member selects the previous month on the dashboard
- **THEN** the summary tiles and the table show the previous month, and the gauge still
  shows the current month

#### Scenario: A figure that is not measured

- **WHEN** a project's KPI is a CPL target and it has no leads this month
- **THEN** it counts as unrated

#### Scenario: A KPI set by hand

- **WHEN** a project's KPI set by hand has the value 50 and the target 40
- **THEN** it counts as met, whatever its figures for the month

#### Scenario: No projects

- **WHEN** a member reaches no projects
- **THEN** the gauge's arc is grey and it reads —

### Requirement: The dashboard warns about projects without a KPI

Beside the gauge, the dashboard SHALL show a panel titled Важная информация, the place for
notices that need a member's attention. It SHALL list every project the member reaches that has no KPI, by name, with the note KPI не задан and the
number of such projects. A project whose KPI is set but not measured SHALL NOT be listed.
Choosing a project SHALL open it, keeping the dashboard's period. When every project has a
KPI, the panel SHALL say Во всех проектах задан KPI. The list SHALL follow a KPI being set or
cleared without a reload.

#### Scenario: Projects without a KPI

- **WHEN** a member reaches Клиника with a KPI and Автосалон and Фитнес without one
- **THEN** the panel lists Автосалон and Фитнес, each with KPI не задан, and gives their
  number as 2

#### Scenario: Opening a project to set its KPI

- **WHEN** the member chooses Автосалон in the panel
- **THEN** Автосалон's project page opens with the dashboard's period

#### Scenario: A KPI that is not measured

- **WHEN** a project's KPI is a CPL target and it has no leads this month
- **THEN** the panel does not list it

#### Scenario: Every project has a KPI

- **WHEN** every project the member reaches has a KPI
- **THEN** the panel lists no project and says Во всех проектах задан KPI
