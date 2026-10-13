## MODIFIED Requirements

### Requirement: The summary starts with leads and a placeholder
A member who has not configured the dashboard's summary SHALL see one tile, Лиды. A project
created from now on SHALL start with no tile, until somebody chooses its tiles; a project
that existed before keeps Лиды. A member who may change the summary SHALL see the chosen
tiles followed by a placeholder tile of the same size with a thick dashed
border and a plus sign in its centre. The placeholder SHALL be a control with the accessible
name Настроить показатели and SHALL stay after the chosen tiles whatever their number. A
member who may not change the summary, and every member on the campaign page, SHALL see no
placeholder.

#### Scenario: First visit
- **WHEN** a member opens the dashboard for the first time
- **THEN** the summary shows the Лиды tile and the placeholder, and no other tile

#### Scenario: A new project
- **WHEN** a manager opens a project created moments ago
- **THEN** the summary shows no tile, only the placeholder

#### Scenario: A new project seen by a guest
- **WHEN** a guest opens a project whose tiles nobody has chosen since it was created
- **THEN** the summary shows no tile and no placeholder

#### Scenario: Placeholder after the chosen tiles
- **WHEN** a member has chosen three tiles
- **THEN** the placeholder follows the third tile

#### Scenario: Campaign page
- **WHEN** a member opens a campaign page
- **THEN** the summary shows the chosen tiles and no placeholder

#### Scenario: A guest on a project page
- **WHEN** a guest opens a project page
- **THEN** the summary shows the project's tiles and no placeholder

### Requirement: Tiles are chosen in a dialog with a limit of five
Activating the placeholder SHALL open a dialog titled Показатели за период that shows a thumbnail of every tile available on that screen, rendered like the tile itself with the figures of the current period. Each thumbnail SHALL toggle its tile and expose whether it is selected, and selected thumbnails SHALL carry a highlighted border. The dialog SHALL show the number of selected tiles against the limit, as in `2/5`. No more than five tiles SHALL be selectable: while five are selected, unselected thumbnails SHALL be disabled and say that the limit is reached. Changes SHALL apply to the summary immediately. The summary SHALL show selected tiles in the order of the catalogue: Расход, Показы, Клики, Лиды, CPC, KPI.

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
The catalogue SHALL offer Расход with CPM, Показы with frequency, Клики with CTR, Лиды with CPL, CPC with reach, and KPI. KPI SHALL be offered on the project page to every member who may change its tiles, and on the dashboard only to members who reach the whole organization. When the project's choice includes KPI, the project page SHALL show the KPI tile to everyone who opens it, and the campaign page SHALL show the KPI tile with the project's KPI compared with the campaign's figures for the period, and SHALL offer no control to set, change or clear a KPI. A stored tile that is not available to the member on that screen SHALL be ignored rather than shown.

#### Scenario: A customer's dashboard
- **WHEN** a customer opens the tile dialog on the dashboard
- **THEN** the KPI thumbnail is not offered

#### Scenario: A project page
- **WHEN** a manager opens the tile dialog on a project page
- **THEN** the KPI thumbnail is offered

#### Scenario: KPI on a campaign page
- **WHEN** the project has a KPI of 60 leads a month, the project's choice includes KPI, and an admin opens one of its campaigns for all of September
- **THEN** the campaign summary shows the KPI tile with the campaign's leads against the target 60 and no control to change the target

## REMOVED Requirements

### Requirement: The choice belongs to the person and the screen
**Reason**: The project page's choice is no longer a person's; it belongs to the project and is shared by everyone who opens it.
**Migration**: Replaced by "The dashboard's choice is personal, a project's is shared". Every choice kept in a browser is dropped; every member and every existing project start from Лиды, new projects from no tile, and tiles are chosen again.

## ADDED Requirements

### Requirement: The dashboard's choice is personal, a project's is shared
The dashboard's tiles SHALL be chosen by each member for themselves and kept on the server
against their membership: the choice SHALL belong to the signed-in member, SHALL survive
reload and signing in on another browser, and SHALL NOT apply to anybody else. Every member
MAY change their own dashboard's tiles, whatever their role, and the API SHALL refuse more
than five tiles, a repeated tile or a tile outside the catalogue with 400.

A project page's tiles SHALL belong to the project: every member who opens the project SHALL
see the same tiles, each project SHALL keep its own, and the choice SHALL survive reload and
signing in elsewhere. Only an `ADMIN` or a `MANAGER` SHALL change them; the API SHALL refuse
anybody else with 403, a project the member does not reach with 404, and a choice of more
than five tiles, a repeated tile or a tile outside the catalogue with 400. Every campaign
page SHALL show the tiles chosen for its project, with the campaign's figures.

No summary tiles SHALL be kept in the browser: a choice kept there before this change SHALL
be ignored on every screen, and choosing tiles SHALL NOT write to the browser's storage.

#### Scenario: Separate screens
- **WHEN** a member adds Расход on the dashboard
- **THEN** project and campaign summaries do not show Расход

#### Scenario: Campaigns follow the project page
- **WHEN** a manager adds Клики on a project page and anybody opens one of its campaigns
- **THEN** the campaign summary shows Лиды and Клики with the campaign's figures

#### Scenario: An earlier campaign choice
- **WHEN** a member had chosen Расход on the campaign page in their browser and the project's choice does not include it
- **THEN** the campaign summary does not show Расход

#### Scenario: Everyone sees the project's choice
- **WHEN** a manager adds Клики on a project page and a guest then opens that project
- **THEN** the guest's summary shows Лиды and Клики

#### Scenario: Each project its own
- **WHEN** a manager adds Клики on one project page
- **THEN** another project's page does not show Клики

#### Scenario: Another person
- **WHEN** a different person signs in on the same browser
- **THEN** their dashboard summary starts with Лиды and the placeholder

#### Scenario: Another browser
- **WHEN** a member adds Расход on the dashboard and signs in on another browser
- **THEN** the dashboard there shows Расход and Лиды

#### Scenario: A choice kept in the browser before
- **WHEN** a member had chosen CPC on the dashboard in their browser before this change
- **THEN** their dashboard shows Лиды alone until they choose again

#### Scenario: A guest tries to change a project's tiles
- **WHEN** a guest asks the API to change a project's tiles
- **THEN** the API responds 403 and the tiles are unchanged

#### Scenario: Too many tiles
- **WHEN** a manager asks the API to set six tiles on a project
- **THEN** the API responds 400 and the tiles are unchanged
