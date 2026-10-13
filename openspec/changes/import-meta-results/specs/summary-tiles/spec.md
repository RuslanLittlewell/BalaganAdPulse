## MODIFIED Requirements

### Requirement: Tiles are chosen in a dialog with a limit of five
Activating the placeholder SHALL open a dialog titled Показатели за период that shows a thumbnail of every tile available on that screen, rendered like the tile itself with the figures of the current period. Each thumbnail SHALL toggle its tile and expose whether it is selected, and selected thumbnails SHALL carry a highlighted border. The dialog SHALL show the number of selected tiles against the limit, as in `2/5`. No more than five tiles SHALL be selectable: while five are selected, unselected thumbnails SHALL be disabled and say that the limit is reached. Changes SHALL apply to the summary immediately. The summary SHALL show selected tiles in the order of the catalogue: Расход, Показы, Клики, Лиды, Результаты, CPC, KPI.

Tiles SHALL be saved to the server as each change is made, on the dashboard and on a project
page alike. A change the API refuses SHALL be
undone on the page, and the member SHALL be told it was not saved.

#### Scenario: Add a tile
- **WHEN** a member selects the Расход thumbnail in the dialog
- **THEN** the counter reads 2/5, the thumbnail is marked selected, and the summary shows Расход before Лиды

#### Scenario: Remove a tile
- **WHEN** a member deselects every thumbnail
- **THEN** the counter reads 0/5 and the summary shows only the placeholder

#### Scenario: The limit
- **WHEN** five tiles are selected
- **THEN** the counter reads 5/5 and the remaining thumbnail cannot be selected

#### Scenario: A project's choice is not saved
- **WHEN** a manager adds Клики on a project page and the API refuses the change
- **THEN** the summary no longer shows Клики and the manager is told the change was not saved

### Requirement: The available tiles
The catalogue SHALL offer Расход with CPM, Показы with frequency, Клики with CTR, Лиды with CPL, Результаты with Цена результата, CPC with reach, and KPI. KPI SHALL be offered on the project page to every member who may change its tiles, and on the dashboard only to members who reach the whole organization. When the project's choice includes KPI, the project page SHALL show the KPI tile to everyone who opens it, and the campaign page SHALL show the KPI tile with the project's KPI compared with the campaign's figures for the period, and SHALL offer no control to set, change or clear a KPI. A stored tile that is not available to the member on that screen SHALL be ignored rather than shown.

#### Scenario: A customer's dashboard
- **WHEN** a customer opens the tile dialog on the dashboard
- **THEN** the KPI thumbnail is not offered

#### Scenario: A project page
- **WHEN** a manager opens the tile dialog on a project page
- **THEN** the KPI thumbnail is offered

#### Scenario: KPI on a campaign page
- **WHEN** the project has a KPI of 60 leads a month, the project's choice includes KPI, and an admin opens one of its campaigns for all of September
- **THEN** the campaign summary shows the KPI tile with the campaign's leads against the target 60 and no control to change the target

#### Scenario: The results tile
- **WHEN** a manager adds Результаты on a project page whose campaigns recorded 56 results for 220.58 in the period
- **THEN** the tile shows 56 with Цена результата 3,94 in the project's currency, between Лиды and CPC
