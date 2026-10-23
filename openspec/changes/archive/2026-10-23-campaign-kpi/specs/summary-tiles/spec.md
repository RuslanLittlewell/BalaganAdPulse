## MODIFIED Requirements

### Requirement: The available tiles
The catalogue SHALL offer Расход with CPM, Показы with frequency, Клики with CTR, Лиды with CPL, CPC with reach, and KPI. KPI SHALL be offered on the project page to every member, and on the dashboard only to members who reach the whole organization. The campaign page SHALL show the campaign's own KPI tile, comparing the campaign's KPI with the campaign's figures for the period, in the place of KPI when the project page's choice includes it and after the chosen tiles otherwise. It SHALL NOT show the project's KPI tiles. The campaign's tile SHALL offer the control to set, change or clear the campaign's KPI to members who may manage KPIs, and to nobody in preview. A stored tile that is not available to the member on that screen SHALL be ignored rather than shown.

#### Scenario: A customer's dashboard
- **WHEN** a customer opens the tile dialog on the dashboard
- **THEN** the KPI thumbnail is not offered

#### Scenario: A project page
- **WHEN** a guest opens the tile dialog on a project page
- **THEN** the KPI thumbnail is offered

#### Scenario: KPI on a campaign page
- **WHEN** a campaign has a KPI of 60 leads a month, the project page's choice includes KPI, and an admin opens the campaign for all of September
- **THEN** the campaign summary shows the KPI tile with the campaign's leads against the target 60 and a control to change it

#### Scenario: A choice without KPI
- **WHEN** the project page's choice holds Клики and Лиды only and a manager opens a campaign
- **THEN** the campaign summary shows Клики, Лиды and the campaign's KPI tile, in that order

#### Scenario: A guest on a campaign page
- **WHEN** a guest opens a campaign without a KPI
- **THEN** its KPI tile says no target is set and offers no control
