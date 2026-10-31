## REMOVED Requirements

### Requirement: A project KPI can be set by hand
**Reason**: Its target no longer stays as entered whatever the period; it is recalculated for
the period like a monthly metric's.
**Migration**: Replaced by "A project KPI can be set by hand against a monthly target". Stored
KPIs keep their name, value and target; only the comparison changes.

## ADDED Requirements

### Requirement: A project KPI can be set by hand against a monthly target

Besides a KPI on a measured metric, a project SHALL be able to hold a KPI set by hand,
made of a name, a value and a target. The name SHALL be non-empty after trimming and at
most 100 characters; the value SHALL be zero or a positive number and the target a
positive number, both stored with four decimal places. It SHALL be the project's one KPI:
setting it SHALL replace a metric KPI, and setting a metric KPI SHALL replace it. Only a
project SHALL hold one; a request to set a KPI by hand on the organization or a campaign
SHALL be refused with 400. Who may read, set and clear it, and the audit of every change,
SHALL be as for any project KPI, the audit naming its name, value and target.

Its value SHALL change only when a member edits the KPI: advertising imports and the
selected period SHALL NOT change it. Its target SHALL be a target for a month, recalculated
for the selected period as the target of a monthly metric is: each day of the period SHALL
add the target divided by the number of days in that day's month. Progress SHALL be the value
over the recalculated target, higher being better: met when equal, exceeded when above. The
check that every KPI of a project is met in the current month SHALL recalculate it for the
month so far in the same way.

The project's KPI dialog SHALL offer Вручную beside the metrics. Choosing it SHALL show the
fields Название, Значение and Цель, and say that the target is for a month and recalculated
for the selected period while the value changes only by hand. Editing a KPI set by hand SHALL
open with Вручную chosen and its fields filled. The dialogs of the organization and of
campaigns SHALL NOT offer it.

The KPI tile SHALL show a KPI set by hand under its name, with the value, the recalculated
target, the percentage, the progress indicator and the status as for any KPI. The project's
marker in the project list SHALL follow its progress. A project KPI set by hand SHALL NOT stand
in for a campaign without its own KPI: such a campaign's indicator SHALL be grey, as when
neither has a KPI.

#### Scenario: Setting a KPI by hand

- **WHEN** a manager opens a project's KPI dialog for all of September, chooses Вручную and
  saves the name Продажи, the value 30 and the target 50
- **THEN** the project's tile reads KPI · Продажи, shows 30 against a target of 50 and 60%,
  and its marker in the project list is red

#### Scenario: Met by hand

- **WHEN** a project's KPI set by hand has the value 50 and the target 50 and the period is all
  of September
- **THEN** the tile shows 100% and Выполнено, and the marker is green

#### Scenario: The target follows the period

- **WHEN** a member switches the period of a project whose KPI set by hand has the value 30
  and the target 50 to 1–15 September
- **THEN** the tile shows 30 against a target of 25, 120% and Выполнено+

#### Scenario: The value stays as entered

- **WHEN** a member switches the period of a project whose KPI was set by hand
- **THEN** the tile shows the same value

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
