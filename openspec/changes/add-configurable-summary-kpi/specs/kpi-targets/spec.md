## Purpose

Give the organization, each project and each campaign one measurable goal, a metric and a target, so that the period summary can show how the actual figure compares with it.

## ADDED Requirements

### Requirement: One KPI per organization, project and campaign
The organization, every project and every campaign SHALL each hold at most one KPI, made of a metric and a positive target stored with four decimal places. The metric SHALL be one of spend, impressions, reach, clicks, leads, revenue, CTR, CPC, CPM, CPL, ROAS and frequency. Setting a KPI SHALL replace the previous one at that level, and clearing it SHALL leave none. KPIs of different levels SHALL be independent. Deleting a project or campaign SHALL delete its KPI. Advertising imports SHALL NOT change KPIs.

#### Scenario: Set and replace
- **WHEN** a manager sets a project KPI of 50 leads and then of 20 CPL
- **THEN** the project holds only the CPL KPI

#### Scenario: Independent levels
- **WHEN** a campaign KPI is set
- **THEN** its project's KPI and the organization KPI are unchanged

#### Scenario: Invalid target
- **WHEN** a request names an unknown metric or a target that is not a positive number
- **THEN** the API responds 400 and the KPI is unchanged

#### Scenario: Import keeps the KPI
- **WHEN** a Meta import updates a campaign that has a KPI
- **THEN** the campaign's KPI is unchanged

### Requirement: Who reads and sets a KPI
A project or campaign KPI SHALL be readable by every member who reaches that project or campaign, and settable or clearable by members whose role may update projects or campaigns respectively. The organization KPI SHALL be readable, settable and clearable only by members who reach the whole organization and may update it. Unreachable projects and campaigns SHALL answer 404; a reachable level the member may not change SHALL answer 403. Every set and clear SHALL record an audit event naming the level, the metric and the target before and after.

#### Scenario: A client reads their project's KPI
- **WHEN** a client reads the KPI of their own project
- **THEN** it is returned

#### Scenario: A client changes a KPI
- **WHEN** a client tries to set their project's KPI
- **THEN** the API responds 403

#### Scenario: A manager and the organization KPI
- **WHEN** a manager requests or sets the organization KPI
- **THEN** the API responds 403

#### Scenario: Audited change
- **WHEN** a manager sets a campaign KPI
- **THEN** an audit event records the campaign, the metric and the previous and new targets

### Requirement: Targets follow the reporting period
For spend, impressions, reach, clicks, leads and revenue, the target SHALL be a monthly amount. It SHALL be compared with the period total after prorating: each day of the selected period contributes the target divided by the number of days in that day's calendar month. For CTR, CPC, CPM, CPL, ROAS and frequency, the target SHALL be compared with the period value as it is. CPC, CPM, CPL and frequency SHALL be met when the actual value is at or below the target; every other metric SHALL be met when it is at or above.

#### Scenario: A full month
- **WHEN** a project with a KPI of 60 leads a month is read for all of September
- **THEN** its target for the period is 60

#### Scenario: A week
- **WHEN** the same project is read for seven days of September
- **THEN** its target for the period is 14

#### Scenario: A period across two months
- **WHEN** the period covers the last day of August and the first day of September
- **THEN** the target is 60/31 + 60/30

#### Scenario: Lower is better
- **WHEN** a campaign's KPI is a CPL of 20 and its CPL for the period is 18
- **THEN** the KPI is met

### Requirement: The KPI tile shows the goal against the figure
The KPI tile SHALL name the level's metric and show the actual figure for the period, the target for the period, the percentage achieved and a progress indicator, exposing whether the KPI is met, not met or not measurable. The percentage SHALL be actual over target, or target over actual for metrics that are better lower. A ratio with no measured value SHALL be not measurable rather than zero. Without a KPI, the tile SHALL say that no target is set and, for members allowed to change it, offer to set one. Members allowed to change the KPI SHALL be able to open a dialog from the tile to choose the metric and target, see whether the target is monthly or applies as it is, save it, or clear it.

#### Scenario: A KPI being met
- **WHEN** a project with a KPI of 60 leads a month recorded 45 leads in half of September
- **THEN** the tile shows 45 against 30, 150% and that the KPI is met

#### Scenario: No target yet
- **WHEN** a manager views a project without a KPI
- **THEN** the tile says no target is set and offers Задать цель

#### Scenario: A reader
- **WHEN** a guest views a project with a KPI
- **THEN** the tile shows the KPI without controls to change it

#### Scenario: Not measurable
- **WHEN** a campaign's KPI is a CPL target and the period has no leads
- **THEN** the tile shows that the KPI cannot be measured for the period
