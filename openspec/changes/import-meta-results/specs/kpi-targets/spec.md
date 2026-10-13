## MODIFIED Requirements

### Requirement: One KPI per organization, project and campaign
The organization, every project and every campaign SHALL each hold at most one KPI, made of a metric and a positive target stored with four decimal places. The metric SHALL be one of spend, impressions, reach, clicks, leads, results, revenue, CTR, CPC, CPM, CPL, cost per result, ROAS and frequency. Setting a KPI SHALL replace the previous one at that level, and clearing it SHALL leave none. KPIs of different levels SHALL be independent. Deleting a project or campaign SHALL delete its KPI. Advertising imports SHALL NOT change KPIs.

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

### Requirement: Targets follow the reporting period
For spend, impressions, reach, clicks, leads, results and revenue, the target SHALL be a monthly amount. It SHALL be compared with the period total after prorating: each day of the selected period contributes the target divided by the number of days in that day's calendar month. For CTR, CPC, CPM, CPL, cost per result, ROAS and frequency, the target SHALL be compared with the period value as it is. CPC, CPM, CPL, cost per result and frequency SHALL be met when the actual value is at or below the target; every other metric SHALL be met when it is at or above.

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

#### Scenario: A results target
- **WHEN** a campaign's KPI is 60 results a month and it recorded 56 results in all of September
- **THEN** its progress is 93% and its indicator is yellow

#### Scenario: A cost per result target
- **WHEN** a campaign's KPI is a cost per result of 5 and its cost per result for the period is 3.94
- **THEN** the KPI is met
