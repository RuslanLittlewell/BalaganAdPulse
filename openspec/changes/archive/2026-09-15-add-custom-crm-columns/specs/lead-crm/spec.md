## ADDED Requirements

### Requirement: Four fixed stages followed by the board's own columns
Every board SHALL show four fixed stages first, in order: `NEW` (Новый), `QUALIFIED` (Квалифицированный), `TARGET` (Целевой), `PROPOSAL` (КП). Fixed stages SHALL NOT be renamed, moved or deleted. Each board SHALL then show its own custom columns in their stored order, followed by a placeholder column with a dashed border and a plus sign, named Добавить столбец, for members who may manage the board's columns. New leads SHALL default to `NEW`. Members SHALL be able to move leads directly between any fixed stage or custom column of the same board. Qualification SHALL remain a manual decision without mandatory fields or automatic checks.

#### Scenario: New lead
- **WHEN** a member creates a lead without specifying a stage
- **THEN** it appears last in Новый

#### Scenario: Unknown stage
- **WHEN** a request names a stage that is neither a fixed stage nor a column of that board
- **THEN** the API responds 400 without storing changes

#### Scenario: A column of another board
- **WHEN** a request moves a lead into a custom column that belongs to another board
- **THEN** the API responds 400 and the lead is unchanged

#### Scenario: Moving between fixed and custom columns
- **WHEN** a lead is moved from КП into a custom column and back
- **THEN** only its stage, ordering, update metadata and history change

### Requirement: Board columns are created, renamed, reordered and deleted
A member who may manage leads on a board SHALL be able to create a custom column with a name, rename it, move it one place left or right among the board's custom columns, and delete it. Column names SHALL be trimmed, nonblank, at most 50 characters, and unique on their board without regard to case, including the fixed stage names. A board SHALL hold at most 20 custom columns. Deleting a column SHALL require confirmation stating how many leads it holds, and SHALL move those leads to the end of Новый in their existing order in the same transaction. Columns SHALL belong to one board and SHALL be removed with it.

#### Scenario: Create a column
- **WHEN** a member activates Добавить столбец and enters Встреча
- **THEN** a column Встреча appears after the last column of that board only

#### Scenario: Duplicate name
- **WHEN** a member names a column Целевой or the name of an existing column in any letter case
- **THEN** the API responds 400 and nothing changes

#### Scenario: Rename a column
- **WHEN** a member renames Встреча to Встреча назначена
- **THEN** the column keeps its place and leads under the new name

#### Scenario: Move a column
- **WHEN** a member moves the second custom column left
- **THEN** it becomes the first custom column and the fixed stages keep their places

#### Scenario: Delete a column with leads
- **WHEN** a member confirms deleting a column holding three leads
- **THEN** the column disappears and the three leads appear at the end of Новый in their previous order

#### Scenario: Cancel deletion
- **WHEN** a member cancels deleting a column
- **THEN** the column and its leads are unchanged

#### Scenario: Fixed stages cannot be changed
- **WHEN** a request renames, moves or deletes a fixed stage
- **THEN** the API responds 400 and nothing changes

## MODIFIED Requirements

### Requirement: Separate agency and client funnels
The CRM SHALL provide one agency board per organization and one board per client, including clients with no projects. A lead and a custom column SHALL each belong to exactly one board. Changing lead details or stage SHALL NOT change its board. Moving leads or columns between boards SHALL NOT be supported in this release.

#### Scenario: Empty client board
- **WHEN** an authorized member opens a client board with no leads, projects or custom columns
- **THEN** the four empty fixed stages and the placeholder column are displayed and permitted creation controls are available

#### Scenario: Board isolation
- **WHEN** a member selects a client board
- **THEN** only leads and custom columns belonging to that client board appear, never the agency's or another client's

### Requirement: CRM uses the task board visual language
The CRM SHALL appear in navigation at `/crm`. It SHALL use the task board's column panels, card styling, spacing, scroll behavior, drag overlay and keyboard drag affordance. Each card SHALL show name, supplied company and contact details, and acquisition source. Long values SHALL truncate on the card and be readable in its detail dialog. Empty contacts SHALL NOT produce blank rows. Notes SHALL be editable in the dialog. Contact actions SHALL NOT initiate a drag or accidentally open the editor. The lead dialog's stage choice SHALL offer every fixed stage and custom column of the lead's board in board order.

#### Scenario: Opening a card
- **WHEN** a member clicks or keyboard-opens a lead card
- **THEN** a dialog shows the lead's full fields and stage, with editing controls only when permitted

#### Scenario: Narrow display
- **WHEN** the viewport cannot fit every column
- **THEN** columns scroll horizontally and each column's cards scroll vertically within the available board height

#### Scenario: Stage choice with custom columns
- **WHEN** a member opens a lead on a board with a custom column Встреча
- **THEN** the stage choice lists Новый, Квалифицированный, Целевой, КП and Встреча in that order

### Requirement: Stable atomic ordering and deletion
Leads SHALL have stable ordering per board and per fixed stage or custom column, and custom columns SHALL have stable contiguous ordering per board. Creation SHALL append, editing SHALL preserve order, and moving SHALL atomically update stage and position together with affected neighbors. Out-of-range positive positions SHALL append; negative or noninteger positions SHALL return 400. Concurrent moves SHALL preserve unique contiguous ordering. The UI SHALL show moves optimistically and restore authoritative state with feedback after failure. Deleting a lead SHALL require confirmation and close the ordering gap.

#### Scenario: Move persists
- **WHEN** a lead is moved between two cards in another column and the page reloads
- **THEN** the lead remains between those cards in that column

#### Scenario: Refused move
- **WHEN** a drag request fails
- **THEN** persisted data stays unchanged and the board restores server state and shows an error

#### Scenario: Concurrent moves
- **WHEN** two members move cards into the same position concurrently
- **THEN** both completed changes result in one consistent order without duplicate positions

#### Scenario: Confirm deletion
- **WHEN** a member cancels deletion
- **THEN** the lead remains unchanged

### Requirement: Lead changes are audited and synchronized
Each successful lead or column mutation by a member SHALL record its actor, board, lead or column and changed fields in an audit event committed with the mutation. Failed writes SHALL record no event. Leads created by a Meta import SHALL NOT be attributed to any member; the lead's recorded source and submission time SHALL identify how it arrived, and later member mutations of it SHALL be audited like any other. Open authorized CRM boards SHALL receive committed changes, including imported leads and column changes, through realtime notifications and refresh their selected board; notifications SHALL carry no lead contact data. Authorization SHALL be checked at delivery time. Reconnection SHALL refresh the selected board. Loss of access SHALL clear inaccessible cached data and stop delivery.

#### Scenario: Another member updates a lead
- **WHEN** an authorized member changes a lead on the open board
- **THEN** the other member's board updates without a manual reload

#### Scenario: Another member adds a column
- **WHEN** an authorized member creates a column on the open board
- **THEN** the other member's board shows it without a manual reload

#### Scenario: Unreachable changes
- **WHEN** a lead changes on a board a connected member cannot access
- **THEN** that connection receives no notification about it

#### Scenario: Audit isolation
- **WHEN** a customer requests audit history
- **THEN** CRM events about the agency or other clients are excluded, including their contact fields

#### Scenario: Imported lead arrives on an open board
- **WHEN** a lead poll commits a new lead to a board a member has open
- **THEN** the card appears without a manual reload and no audit event names a member as its creator

## REMOVED Requirements

### Requirement: Eight fixed sales stages
**Reason**: Replaced by four fixed stages followed by each board's own columns.
**Migration**: Leads in `CONTACTED`, `NEGOTIATION`, `WON`, `LOST` and `DEFERRED` move to the end of `NEW`, keeping their relative order; `QUALIFIED` and `PROPOSAL` keep their leads.
