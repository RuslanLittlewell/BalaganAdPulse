# summary-tiles Specification

## Purpose
Let each member choose which figures the period summary shows on the dashboard, the project page and the campaign page, so the summary carries what they actually track.

## Requirements

### Requirement: The summary starts with leads and a placeholder
A member who has not configured a screen's summary SHALL see one tile, Лиды, followed by a placeholder tile of the same size with a thick dashed border and a plus sign in its centre. The placeholder SHALL be a control with the accessible name Настроить показатели and SHALL stay after the chosen tiles whatever their number.

#### Scenario: First visit
- **WHEN** a member opens the dashboard for the first time
- **THEN** the summary shows the Лиды tile and the placeholder, and no other tile

#### Scenario: Placeholder after the chosen tiles
- **WHEN** a member has chosen three tiles
- **THEN** the placeholder follows the third tile

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
The catalogue SHALL offer Расход with CPM, Показы with frequency, Клики with CTR, Лиды with CPL, CPC with reach, and KPI. KPI SHALL be offered on the project and campaign pages to every member, and on the dashboard only to members who reach the whole organization. A stored tile that is not available to the member on that screen SHALL be ignored rather than shown.

#### Scenario: A customer's dashboard
- **WHEN** a customer opens the tile dialog on the dashboard
- **THEN** the KPI thumbnail is not offered

#### Scenario: A project page
- **WHEN** a guest opens the tile dialog on a project page
- **THEN** the KPI thumbnail is offered

### Requirement: The choice belongs to the person and the screen
The selected tiles SHALL be remembered separately for the dashboard, the project page and the campaign page, the same for every project and every campaign. The choice SHALL belong to the signed-in person, SHALL survive reload, and SHALL NOT apply to another person signing in on the same browser.

#### Scenario: Separate screens
- **WHEN** a member adds Расход on the dashboard
- **THEN** project and campaign summaries keep their own tiles

#### Scenario: Every project alike
- **WHEN** a member adds Клики on one project page
- **THEN** every other project page shows Клики as well

#### Scenario: Another person
- **WHEN** a different person signs in on the same browser
- **THEN** their summaries start with Лиды and the placeholder
