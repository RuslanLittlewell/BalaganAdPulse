## ADDED Requirements

### Requirement: The projects summary carries each project's KPI

Each entry of the reading that returns every reachable project's figures in one request
SHALL also carry that project's own KPI: its metric and its target with four decimal
places, or null when the project has none. A campaign's KPI SHALL NOT stand in for the
project's. The KPI SHALL be returned whatever the range, so a client can compare it with
the figures beside it.

#### Scenario: A project with a KPI

- **WHEN** a member reads the projects summary and a reachable project holds a KPI of 60 leads
- **THEN** that project's entry carries the metric and the target 60.0000

#### Scenario: A project without a KPI

- **WHEN** a reachable project holds no KPI while one of its campaigns does
- **THEN** that project's entry carries a null KPI
