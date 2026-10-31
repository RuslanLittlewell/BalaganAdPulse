## MODIFIED Requirements

### Requirement: Tiles are chosen in a dialog with a limit of five
Activating the placeholder SHALL open a dialog titled Показатели за период that shows a thumbnail of every tile available on that screen, rendered like the tile itself with the figures of the current period. Each thumbnail SHALL toggle its tile and expose whether it is selected, and selected thumbnails SHALL carry a highlighted border. The dialog SHALL show the number of selected tiles against the limit, as in `2/5`. No more than five tiles SHALL be selectable: while five are selected, unselected thumbnails SHALL be disabled and say that the limit is reached. Changes SHALL apply to the summary immediately. The summary SHALL show selected tiles in the order they were arranged, and a tile selected in the dialog SHALL join the summary as its last tile.

Tiles SHALL be saved to the server as each change is made, on the dashboard and on a project
page alike. A change the API refuses SHALL be
undone on the page, and the member SHALL be told it was not saved.

#### Scenario: Add a tile
- **WHEN** a member selects the Расход thumbnail in the dialog
- **THEN** the counter reads 2/5, the thumbnail is marked selected, and the summary shows Расход after Лиды

#### Scenario: Remove a tile
- **WHEN** a member deselects every thumbnail
- **THEN** the counter reads 0/5 and the summary shows only the placeholder

#### Scenario: The limit
- **WHEN** five tiles are selected
- **THEN** the counter reads 5/5 and the remaining thumbnail cannot be selected

#### Scenario: A project's choice is not saved
- **WHEN** a manager adds Клики on a project page and the API refuses the change
- **THEN** the summary no longer shows Клики and the manager is told the change was not saved

## ADDED Requirements

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
