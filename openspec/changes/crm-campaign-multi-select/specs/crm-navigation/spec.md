## RENAMED Requirements

- FROM: `### Requirement: The CRM can be scoped to one campaign`
- TO: `### Requirement: The CRM can be scoped to campaigns`

## MODIFIED Requirements

### Requirement: The CRM can be scoped to campaigns

When the member's CRM by campaign preference is on, the CRM menu column SHALL show a campaign multi-select directly under the board picker. It SHALL list every campaign of the selected board's project, whatever its status, with running campaigns first and each campaign marked as running or stopped, and an option for all campaigns, which is selected by default. Checking one or more campaigns SHALL limit the leads shown on the board, in the table and in the tasks view, and the lead count of the section Лиды, to leads of the checked campaigns. Picking the all campaigns option SHALL clear the choice. The choice SHALL be kept in the address as one `campaign` parameter per campaign and SHALL be cleared when the board changes. When the preference is off, the select SHALL NOT appear and no campaign scope SHALL apply, even if the address names campaigns.

#### Scenario: Choosing a campaign
- **WHEN** a member with the preference on checks a campaign under the board picker
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
- **WHEN** the preference is off
- **THEN** the CRM menu column has no campaign select
