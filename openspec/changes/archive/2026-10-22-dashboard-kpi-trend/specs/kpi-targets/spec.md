## ADDED Requirements

### Requirement: The dashboard project table charts KPI progress

Beside each project's name the dashboard's project table SHALL draw a mini chart of the
project's KPI progress over the selected period. Each point SHALL be the progress reached on
a day with figures, counting the figures from the start of the period up to that day against
the target for the same days, so the last point equals the progress in the Выполнение KPI
column. A project with no KPI, a KPI set by hand, or no measured progress SHALL show no
chart. The chart SHALL be named for assistive technology.

#### Scenario: A project approaching its plan
- **WHEN** a project's KPI is 62 leads for the month, and by the 15th it has gained 30
- **THEN** its chart rises to the progress shown in the Выполнение KPI column

#### Scenario: A project without a KPI
- **WHEN** a project has no KPI
- **THEN** its row shows no chart

#### Scenario: A KPI set by hand
- **WHEN** a project's KPI was entered by hand
- **THEN** its row shows no chart
