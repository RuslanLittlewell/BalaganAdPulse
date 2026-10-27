## MODIFIED Requirements

### Requirement: The projects summary carries each project's KPI

Each entry of the reading that returns every reachable project's figures in one request
SHALL also carry that project's own KPI: its metric and its target with four decimal
places, and for a KPI set by hand also its name and its value with four decimal places,
or null when the project has none. A campaign's KPI SHALL NOT stand in for the project's.
The KPI SHALL be returned whatever the range, so a client can compare it with the figures
beside it. Each KPI SHALL carry the account it names, or null. For each account named by one of
the project's KPIs, the entry SHALL also carry that account's figures for the range and its daily
figures, summed over the project's campaigns imported from it, and zero when there are none.

#### Scenario: A project with a KPI

- **WHEN** a member reads the projects summary and a reachable project holds a KPI of 60 leads
- **THEN** that project's entry carries the metric and the target 60.0000

#### Scenario: A project without a KPI

- **WHEN** a reachable project holds no KPI while one of its campaigns does
- **THEN** that project's entry carries a null KPI

#### Scenario: A project with a KPI set by hand

- **WHEN** a reachable project holds a KPI set by hand named Продажи with the value 30 and
  the target 50
- **THEN** that project's entry carries the metric MANUAL, the name Продажи, the value
  30.0000 and the target 50.0000

#### Scenario: A KPI naming an account

- **WHEN** a reachable project's campaigns come from two accounts and one of its KPIs names the second
- **THEN** that project's entry carries the second account's figures and daily figures, and none for the first
