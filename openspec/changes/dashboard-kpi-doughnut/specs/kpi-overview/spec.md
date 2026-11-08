## RENAMED Requirements

- FROM: `### Requirement: The dashboard gauges this month's KPI performance`
- TO: `### Requirement: The dashboard shows this month's KPI performance as a doughnut`

## MODIFIED Requirements

### Requirement: The dashboard shows this month's KPI performance as a doughnut

The dashboard SHALL show a doughnut titled Выполнение KPI за месяц over every project the member
reaches. It SHALL judge each project by its own KPI over the current month, from the first
day of the month to today, whatever period the dashboard has selected, prorating monthly
targets and rounding progress as the project's marker in the project list does. Each
project SHALL count in one of four groups: Выполняют, Небольшое отставание, Сильное отставание
and Без оценки, by the zones the KPI targets define, with a project that has no KPI or whose
KPI figure is not measured for the month counting as Без оценки.

The doughnut's ring SHALL be divided into the four groups in proportion to their counts, in
the order met, slightly behind, far behind, unrated, starting at the top and going clockwise:
green, yellow, red, grey, the first three in vivid neon tones with a soft glow of the same color and the grey one plain. Each part SHALL be drawn as an outlined ring segment: a border in the group's color and a translucent fill of the same color inside it, so the parts read as ghosted glass and not as solid blocks. The legend's color dots SHALL use the same colors. A group with no projects SHALL take no part of the ring. In the middle
of the ring the doughnut SHALL read the number of met projects out of all projects, as
"7 из 12" in a modest type size that fits the ring and with no caption beside it, and a legend SHALL name each group with its count. The doughnut SHALL expose these
counts to assistive technology rather than through colour alone. Pointing at the ring's yellow part, Небольшое отставание, its red part, Сильное отставание,
or its grey part, Без оценки, SHALL show a tooltip near the pointer that names the group and lists the projects in it by
name, at most ten, with the number of the rest as "и ещё N" when there are more. Nothing over
the ring, such as the number in its middle, SHALL stop the pointer from reaching its parts. The
same tooltip SHALL open when the legend row of either group is focused or pointed at, so the
keyboard and assistive technology reach it, and it SHALL close when the pointer leaves or the
focus moves on. A group with no projects SHALL show no tooltip. It SHALL follow a change of a
project's KPI or figures without a reload. With no projects, the ring SHALL be grey and the
middle SHALL read —.

#### Scenario: Counting projects

- **WHEN** a member reaches 12 projects, of which 7 meet their KPI this month, 2 are slightly
  behind, 1 is far behind and 2 have no KPI
- **THEN** the middle of the doughnut reads 7 из 12 and its legend gives Выполняют 7,
  Небольшое отставание 2, Сильное отставание 1 and Без оценки 2

#### Scenario: Which projects are far behind

- **WHEN** Клиника and Автосалон are far behind and the member points at the red part of the ring
- **THEN** a tooltip headed Сильное отставание lists Клиника and Автосалон, and it closes when the pointer leaves

#### Scenario: Which projects have no KPI set

- **WHEN** Фитнес has no KPI and the member points at the grey part of the ring
- **THEN** a tooltip headed Без оценки lists Фитнес

#### Scenario: Which projects are slightly behind

- **WHEN** Стоматология is slightly behind and the member points at the yellow part of the ring
- **THEN** a tooltip headed Небольшое отставание lists Стоматология

#### Scenario: More than ten projects far behind

- **WHEN** twelve projects are far behind and the member points at the red part
- **THEN** the tooltip lists ten of them and ends with "и ещё 2"

#### Scenario: The tooltip from the keyboard

- **WHEN** the member focuses the legend row of Сильное отставание, Небольшое отставание or Без оценки
- **THEN** the same tooltip is shown, and moving the focus away closes it

#### Scenario: The ring follows the counts

- **WHEN** the legend gives Выполняют 1, Небольшое отставание 1, Сильное отставание 1 and
  Без оценки 1
- **THEN** each of the four colors takes a quarter of the ring

#### Scenario: A monthly target is prorated

- **WHEN** on 15 October a project with a KPI of 62 leads a month has 30 leads since
  1 October
- **THEN** its target for the month so far is 30 and it counts as met

#### Scenario: Somewhat behind is behind

- **WHEN** a project's progress this month is 90%
- **THEN** it does not count as met, although its marker in the project list is yellow

#### Scenario: The period does not move the gauge

- **WHEN** a member selects the previous month on the dashboard
- **THEN** the summary tiles and the table show the previous month, and the doughnut still
  shows the current month

#### Scenario: A figure that is not measured

- **WHEN** a project's KPI is a CPL target and it has no leads this month
- **THEN** it counts as unrated

#### Scenario: A KPI set by hand

- **WHEN** a project's KPI set by hand has the value 50 and the target 40
- **THEN** it counts as met, whatever its figures for the month

#### Scenario: No projects

- **WHEN** a member reaches no projects
- **THEN** the doughnut's ring is grey and its middle reads —

### Requirement: The dashboard warns about projects without a KPI

Beside the doughnut, the dashboard SHALL show a panel titled Важная информация, the place for
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
