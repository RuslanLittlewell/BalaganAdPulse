# summary-tiles Specification

## Purpose
Let each member choose which figures the period summary shows on the dashboard, the project page and the campaign page, so the summary carries what they actually track.

## Requirements

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

### Requirement: Tiles are arranged by dragging
A member who may change a summary SHALL be able to move any of its tiles to another place by
dragging it among the others. While a tile is carried, the other tiles SHALL make room for it
where it would land, and the new order SHALL apply when it is dropped and be saved like any
other change of tiles. Each tile SHALL also carry a move handle, named Переместить показатель
followed by the tile's name, that moves the tile one place earlier with the left or up arrow
and one place later with the right or down arrow, keeps the focus, and announces the tile's
new place. A move past the first or the last place SHALL change nothing.

A project's KPI tile SHALL move as one tile with all of its KPI cards, whichever card is
dragged or moved, and no other tile SHALL land between them. A member who may not change the
summary, every campaign page and the dialog's thumbnails SHALL offer neither dragging nor a
handle. The API SHALL store and return the tiles in the order they were sent.

#### Scenario: Drag a tile
- **WHEN** a manager drags Клики in front of Расход on a project page showing Расход, Лиды and Клики
- **THEN** the summary shows Клики, Расход and Лиды, and everyone who opens the project sees that order

#### Scenario: Move with the keyboard
- **WHEN** a member focuses the handle of Лиды, the second of three tiles, and presses the left arrow
- **THEN** Лиды becomes the first tile, the handle keeps the focus, and Лиды: место 1 из 3 is announced

#### Scenario: Nowhere further
- **WHEN** a member presses the left arrow on the handle of the first tile
- **THEN** the order is unchanged and nothing is saved

#### Scenario: KPI moves as one
- **WHEN** a project holds two KPIs, its tiles are KPI and Расход, and a manager moves KPI one place later
- **THEN** the summary shows Расход followed by both KPI cards side by side

#### Scenario: Nobody else rearranges
- **WHEN** a guest opens a project page
- **THEN** its tiles cannot be dragged and show no move handle

#### Scenario: Campaigns follow the project's order
- **WHEN** a manager arranges a project's tiles as Клики then Лиды and anybody opens one of its campaigns
- **THEN** the campaign summary shows Клики before Лиды

#### Scenario: The API keeps the order
- **WHEN** a member saves CPC then Расход as their dashboard tiles
- **THEN** the API returns and later reads them as CPC then Расход

### Requirement: Each account of a project has its own tiles
When a project's summary is split by account, which happens when the project has more than
one account, each account's tab SHALL show its own tiles in its own order, and choosing,
removing or rearranging tiles in a tab SHALL change that account's tiles alone, saved to the
server for everyone who opens the project. A tab whose tiles nobody has chosen SHALL show the
project's tiles, and its first change SHALL start from them. A project with one account or
none SHALL show and change the project's tiles.

A campaign page SHALL show the tiles of its campaign's account when that account has its own,
and the project's tiles otherwise; a campaign with no account SHALL show the project's tiles.

The API SHALL return each account's tiles alongside the project's when the project's tiles are
read, and SHALL save tiles for one account when the change names a channel and an account ID.
The same roles, limits and errors SHALL apply as to the project's tiles, a change for an
account SHALL be recorded in the audit trail with the account it concerns, and the dashboard
SHALL refuse a change that names an account with 400.

#### Scenario: Different tiles per account
- **WHEN** a project has the accounts Meta · 1 and Google · 2 and a manager adds Клики in the Google · 2 tab
- **THEN** the Google · 2 tab shows Клики, and the Meta · 1 tab still shows the project's tiles without Клики

#### Scenario: A tab nobody configured
- **WHEN** a project's tiles are Лиды and Расход and nobody has chosen tiles for its Meta · 1 account
- **THEN** the Meta · 1 tab shows Лиды and Расход

#### Scenario: Rearranging in a tab
- **WHEN** a manager moves Расход in front of Лиды in the Meta · 1 tab of that project
- **THEN** the Meta · 1 tab shows Расход then Лиды, and the project's own tiles keep Лиды first

#### Scenario: Everyone sees an account's tiles
- **WHEN** a manager adds Клики in the Google · 2 tab and a guest then opens that tab
- **THEN** the guest's summary shows Клики

#### Scenario: A campaign follows its account
- **WHEN** the Google · 2 account has the tiles CPC and Клики and anybody opens one of its campaigns
- **THEN** the campaign summary shows CPC and Клики

#### Scenario: A campaign of an account without tiles
- **WHEN** a campaign's account has no tiles of its own
- **THEN** the campaign summary shows the project's tiles

#### Scenario: A guest names an account
- **WHEN** a guest asks the API to change the tiles of one of a project's accounts
- **THEN** the API responds 403 and nothing is saved

#### Scenario: The dashboard has no accounts
- **WHEN** a member asks the API to save dashboard tiles for an account
- **THEN** the API responds 400 and the dashboard tiles are unchanged

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
