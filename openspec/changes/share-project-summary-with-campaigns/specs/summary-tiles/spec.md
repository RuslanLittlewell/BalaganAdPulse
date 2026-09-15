## MODIFIED Requirements

### Requirement: The summary starts with leads and a placeholder
A member who has not configured the dashboard's or the project page's summary SHALL see one tile, Лиды, followed by a placeholder tile of the same size with a thick dashed border and a plus sign in its centre. The placeholder SHALL be a control with the accessible name Настроить показатели and SHALL stay after the chosen tiles whatever their number. The campaign page SHALL show no placeholder.

#### Scenario: First visit
- **WHEN** a member opens the dashboard for the first time
- **THEN** the summary shows the Лиды tile and the placeholder, and no other tile

#### Scenario: Placeholder after the chosen tiles
- **WHEN** a member has chosen three tiles
- **THEN** the placeholder follows the third tile

#### Scenario: Campaign page
- **WHEN** a member opens a campaign page
- **THEN** the summary shows the chosen tiles and no placeholder

### Requirement: The available tiles
The catalogue SHALL offer Расход with CPM, Показы with frequency, Клики with CTR, Лиды with CPL, CPC with reach, and KPI. KPI SHALL be offered on the project page to every member, and on the dashboard only to members who reach the whole organization. When the project page's choice includes KPI, the campaign page SHALL show the campaign's KPI tile. A stored tile that is not available to the member on that screen SHALL be ignored rather than shown.

#### Scenario: A customer's dashboard
- **WHEN** a customer opens the tile dialog on the dashboard
- **THEN** the KPI thumbnail is not offered

#### Scenario: A project page
- **WHEN** a guest opens the tile dialog on a project page
- **THEN** the KPI thumbnail is offered

### Requirement: The choice belongs to the person and the screen
The selected tiles SHALL be remembered separately for the dashboard and the project page, the same for every project. Every campaign page SHALL show the tiles chosen for the project page, with the campaign's figures, and a campaign page choice stored earlier SHALL be ignored. The choice SHALL belong to the signed-in person, SHALL survive reload, and SHALL NOT apply to another person signing in on the same browser.

#### Scenario: Separate screens
- **WHEN** a member adds Расход on the dashboard
- **THEN** project and campaign summaries do not show Расход

#### Scenario: Campaigns follow the project page
- **WHEN** a member adds Клики on a project page and opens one of its campaigns
- **THEN** the campaign summary shows Лиды and Клики with the campaign's figures

#### Scenario: An earlier campaign choice
- **WHEN** a member had chosen Расход on the campaign page before this change and has not chosen it on the project page
- **THEN** the campaign summary does not show Расход

#### Scenario: Every project alike
- **WHEN** a member adds Клики on one project page
- **THEN** every other project page shows Клики as well

#### Scenario: Another person
- **WHEN** a different person signs in on the same browser
- **THEN** their summaries start with Лиды and the placeholder
