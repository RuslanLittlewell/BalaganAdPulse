# kpi-targets Specification

## Purpose
Give the organization, each project and each campaign one measurable goal, a metric and a target, so that the period summary can show how the actual figure compares with it.

## Requirements

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
A project or campaign KPI SHALL be readable by every member who reaches that project or campaign, and settable or clearable by agency members whose role may manage KPIs. Customers SHALL NOT set or clear KPIs, even on projects they may edit. The organization KPI SHALL be readable, settable and clearable only by members who reach the whole organization and may update it. Unreachable projects and campaigns SHALL answer 404; a reachable level the member may not change SHALL answer 403. Every set and clear SHALL record an audit event naming the level, the metric and the target before and after.

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
The KPI tile SHALL name the level's metric and show the actual figure for the period, the target for the period, the percentage achieved and a progress indicator, exposing whether the KPI is exceeded, met, not met or not measurable. A KPI SHALL be exceeded when the actual figure is strictly better than the period target, and met when it equals it. The percentage SHALL be actual over target, or target over actual for metrics that are better lower. A ratio with no measured value SHALL be not measurable rather than zero. The tile SHALL write a status only when the KPI is met, as Выполнено, or exceeded, as Выполнено+; it SHALL write no status when the KPI is not met or not measurable. While the KPI is exceeded, the progress indicator SHALL be animated, except for members who ask their system to reduce motion. Without a KPI, the tile SHALL say that no target is set and, for members allowed to change it, offer to set one. Members allowed to change the KPI SHALL be able to open a dialog from the tile to choose the metric and target, see whether the target is monthly or applies as it is, save it, or clear it.

#### Scenario: A KPI being exceeded
- **WHEN** a project with a KPI of 60 leads a month recorded 45 leads in half of September
- **THEN** the tile shows 45 against 30, 150%, the status Выполнено+ and an animated progress indicator

#### Scenario: A KPI met exactly
- **WHEN** the same project recorded 30 leads in half of September
- **THEN** the tile shows 100% and the status Выполнено, with a progress indicator that is not animated

#### Scenario: A KPI falling behind
- **WHEN** a campaign's KPI is a CPL of 20 and its CPL for the period is 25
- **THEN** the tile shows 80% and writes no status

#### Scenario: No target yet
- **WHEN** a manager views a project without a KPI
- **THEN** the tile says no target is set and offers Задать цель

#### Scenario: A reader
- **WHEN** a guest views a project with a KPI
- **THEN** the tile shows the KPI without controls to change it

#### Scenario: Not measurable
- **WHEN** a campaign's KPI is a CPL target and the period has no leads
- **THEN** the tile shows no figure, no progress indicator and no status

### Requirement: A campaign's indicator follows its KPI

Each campaign row in a project's campaign table SHALL carry a coloured indicator decided by
the campaign's progress against its KPI for the selected period. The KPI SHALL be the
campaign's own, or the project's when the campaign has none. Progress SHALL be the
percentage achieved as the KPI tile computes it, counting lower-is-better metrics in their
favourable direction. The indicator SHALL be:

- grey when the campaign is not running (paused, rejected or ended), when neither the
  campaign nor the project has a KPI, or when the KPI's figure is not measured;
- red when progress is below 70%: the campaign is far behind and needs urgent measures;
- yellow when progress is from 70% up to 90%: the campaign is somewhat behind and someone
  should look closer and help;
- green when progress is 90% or more: the plan is met or exceeded and nothing is needed.

A campaign that is learning SHALL count as running. The indicator SHALL expose its state to
assistive technology rather than through colour alone.

#### Scenario: Meeting the KPI
- **WHEN** a running campaign's KPI is 30 leads for the period and it has 30
- **THEN** its indicator is green

#### Scenario: The lower boundary of green
- **WHEN** a running campaign has 27 leads against a KPI of 30
- **THEN** its progress is 90% and its indicator is green

#### Scenario: Somewhat behind
- **WHEN** a running campaign has 24 leads against a KPI of 30
- **THEN** its indicator is yellow

#### Scenario: The lower boundary of yellow
- **WHEN** a running campaign has 21 leads against a KPI of 30
- **THEN** its progress is 70% and its indicator is yellow

#### Scenario: Far behind
- **WHEN** a running campaign has 20 leads against a KPI of 30
- **THEN** its progress is 67% and its indicator is red

#### Scenario: Lower is better
- **WHEN** a running campaign's KPI is a CPA of 10 and its CPA is 12
- **THEN** its progress is 83% and its indicator is yellow

#### Scenario: The project's KPI stands in
- **WHEN** a running campaign has no KPI and the project's KPI is met by it
- **THEN** its indicator is green

#### Scenario: Not running
- **WHEN** a campaign is paused, whatever its figures
- **THEN** its indicator is grey

#### Scenario: No KPI anywhere
- **WHEN** neither a running campaign nor its project has a KPI
- **THEN** its indicator is grey

### Requirement: A project KPI can be set by hand

Besides a KPI on a measured metric, a project SHALL be able to hold a KPI set by hand,
made of a name, a value and a target. The name SHALL be non-empty after trimming and at
most 100 characters; the value SHALL be zero or a positive number and the target a
positive number, both stored with four decimal places. It SHALL be the project's one KPI:
setting it SHALL replace a metric KPI, and setting a metric KPI SHALL replace it. Only a
project SHALL hold one; a request to set a KPI by hand on the organization or a campaign
SHALL be refused with 400. Who may read, set and clear it, and the audit of every change,
SHALL be as for any project KPI, the audit naming its name, value and target.

Its value SHALL change only when a member edits the KPI: advertising imports and the
selected period SHALL NOT change it. Progress SHALL be the value over the target, higher
being better: met when equal, exceeded when above. It SHALL be compared as it is, whatever
the period.

The project's KPI dialog SHALL offer Вручную beside the metrics. Choosing it SHALL show the
fields Название, Значение and Цель, and say that they change only by hand and do not depend
on the period. Editing a KPI set by hand SHALL open with Вручную chosen and its fields
filled. The dialogs of the organization and of campaigns SHALL NOT offer it.

The KPI tile SHALL show a KPI set by hand under its name, with the value, the target, the
percentage, the progress indicator and the status as for any KPI. The project's marker in
the project list SHALL follow its progress. A project KPI set by hand SHALL NOT stand in for
a campaign without its own KPI: such a campaign's indicator SHALL be grey, as when neither
has a KPI.

#### Scenario: Setting a KPI by hand

- **WHEN** a manager opens a project's KPI dialog, chooses Вручную and saves the name
  Продажи, the value 30 and the target 50
- **THEN** the project's tile reads KPI · Продажи, shows 30 against a target of 50 and 60%,
  and its marker in the project list is red

#### Scenario: Met by hand

- **WHEN** a project's KPI set by hand has the value 50 and the target 50
- **THEN** the tile shows 100% and Выполнено, and the marker is green

#### Scenario: The period does not matter

- **WHEN** a member switches the period of a project whose KPI was set by hand
- **THEN** the tile shows the same value, target and percentage

#### Scenario: Replacing a metric KPI

- **WHEN** a project holds a KPI of 60 leads and a manager sets a KPI by hand
- **THEN** the project holds only the KPI set by hand

#### Scenario: Missing fields

- **WHEN** a request sets a KPI by hand with an empty name, a negative value or a target
  that is not a positive number
- **THEN** the API responds 400 and the KPI is unchanged

#### Scenario: Not for a campaign

- **WHEN** a manager tries to set a KPI by hand on a campaign or on the organization
- **THEN** the API responds 400, and their KPI dialogs do not offer Вручную

#### Scenario: Campaigns keep their own

- **WHEN** a running campaign has no KPI and its project's KPI was set by hand
- **THEN** the campaign's indicator is grey

#### Scenario: Editing it

- **WHEN** a manager opens the dialog of a project whose KPI was set by hand
- **THEN** Вручную is chosen and Название, Значение and Цель hold its name, value and target
