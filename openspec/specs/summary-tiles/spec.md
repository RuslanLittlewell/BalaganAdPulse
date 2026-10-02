# summary-tiles Specification

## Purpose
Let each member choose which figures the period summary shows on the dashboard, the project page and the campaign page, so the summary carries what they actually track.

## Requirements

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

### Requirement: Tiles are chosen in a dialog with a limit of five
Activating the placeholder SHALL open a dialog titled Показатели за период that shows a thumbnail of every tile available on that screen, rendered like the tile itself with the figures of the current period. Each thumbnail SHALL toggle its tile and expose whether it is selected, and selected thumbnails SHALL carry a highlighted border. The dialog SHALL show the number of selected tiles against the limit, as in `2/5`. No more than five tiles SHALL be selectable: while five are selected, unselected thumbnails SHALL be disabled and say that the limit is reached. Changes SHALL apply to the summary immediately. The summary SHALL show selected tiles in the order of the catalogue: Расход, Показы, Клики, Лиды, CPC, KPI.

#### Scenario: Add a tile
- **WHEN** a member selects the Расход thumbnail in the dialog
- **THEN** the counter reads 2/5, the thumbnail is marked selected, and the summary shows Расход before Лиды

#### Scenario: Remove a tile
- **WHEN** a member deselects every thumbnail
- **THEN** the counter reads 0/5 and the summary shows only the placeholder

#### Scenario: The limit
- **WHEN** five tiles are selected
- **THEN** the counter reads 5/5 and the remaining thumbnail cannot be selected

### Requirement: The available tiles
The catalogue SHALL offer Расход with CPM, Показы with frequency, Клики with CTR, Лиды with CPL, CPC with reach, and KPI. KPI SHALL be offered on the project page to every member, and on the dashboard only to members who reach the whole organization. When the project page's choice includes KPI, the campaign page SHALL show the KPI tile with the project's KPI compared with the campaign's figures for the period, and SHALL offer no control to set, change or clear a KPI. A stored tile that is not available to the member on that screen SHALL be ignored rather than shown.

#### Scenario: A customer's dashboard
- **WHEN** a customer opens the tile dialog on the dashboard
- **THEN** the KPI thumbnail is not offered

#### Scenario: A project page
- **WHEN** a guest opens the tile dialog on a project page
- **THEN** the KPI thumbnail is offered

#### Scenario: KPI on a campaign page
- **WHEN** the project has a KPI of 60 leads a month, the project page's choice includes KPI, and an admin opens one of its campaigns for all of September
- **THEN** the campaign summary shows the KPI tile with the campaign's leads against the target 60 and no control to change the target

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
