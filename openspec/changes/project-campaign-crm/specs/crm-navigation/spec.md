## ADDED Requirements

### Requirement: CRM by campaign is a setting of the project

Each project SHALL have a CRM by campaign setting, off by default. The CRM header SHALL show a
switch labelled CRM по кампаниям directly to the right of the Интеграции button, for members who
may manage the selected board's columns, when a board is selected. The switch SHALL show the
setting of the selected board's project and SHALL save a change at once, for every member of that
project. Members who may not manage the board's columns SHALL NOT see the switch, and a request
from them to change the setting SHALL be refused. A change SHALL be recorded in the audit trail
with the project. When saving fails, the switch SHALL return to the stored setting and the member
SHALL be told.

#### Scenario: Turning it on
- **WHEN** a manager turns on CRM по кампаниям while project A's board is selected
- **THEN** the campaign select appears in the CRM menu, and another member who opens project A's board sees it too

#### Scenario: Another project
- **WHEN** CRM by campaign is on for project A and a member selects project B's board
- **THEN** the switch is off and the CRM menu has no campaign select

#### Scenario: A guest
- **WHEN** a guest opens the CRM of a project with CRM by campaign on
- **THEN** the guest sees the campaign select and no switch

#### Scenario: Saving fails
- **WHEN** the server refuses the change
- **THEN** the switch shows the stored setting and an error is shown

## MODIFIED Requirements

### Requirement: The CRM can be scoped to campaigns

When the selected board's project has CRM by campaign on, the CRM menu column SHALL show a campaign multi-select directly under the board picker. It SHALL list every campaign of the selected board's project, whatever its status, with running campaigns first and each campaign marked as running or stopped, and an option for all campaigns, which is selected by default. Checking one or more campaigns SHALL limit the leads shown on the board, in the table and in the tasks view, and the lead count of the section Лиды, to leads of the checked campaigns. Picking the all campaigns option SHALL clear the choice. The choice SHALL be kept in the address as one `campaign` parameter per campaign and SHALL be cleared when the board changes. When the project's setting is off, the select SHALL NOT appear and no campaign scope SHALL apply, even if the address names campaigns.

#### Scenario: Choosing a campaign
- **WHEN** a member of a project with CRM by campaign on checks a campaign under the board picker
- **THEN** only that campaign's leads appear in the board, table and tasks views

#### Scenario: Choosing several campaigns
- **WHEN** the member checks a second campaign
- **THEN** the leads of both campaigns appear and the select keeps both checked

#### Scenario: Stopped campaigns are listed
- **WHEN** the board's project has a paused campaign
- **THEN** the campaign select lists it after the running campaigns, marked as stopped, and checking it shows its leads

#### Scenario: Returning to all campaigns
- **WHEN** the member picks the all campaigns option
- **THEN** every lead of the board is shown again

#### Scenario: Campaigns in the address
- **WHEN** a member opens the CRM with two `campaign` parameters in the address
- **THEN** the leads of those two campaigns are shown and both are checked in the select

#### Scenario: Changing the board
- **WHEN** the member chooses another board while campaigns are checked
- **THEN** the campaign select shows all campaigns for the new board

#### Scenario: Preference off
- **WHEN** the project's CRM by campaign setting is off
- **THEN** the CRM menu column has no campaign select
