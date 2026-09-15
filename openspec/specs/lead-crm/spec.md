# lead-crm Specification

## Purpose

Track prospects, their contact details and acquisition sources through separate sales funnels for the agency and each client, with a familiar Kanban interface.

## Requirements

### Requirement: Separate agency and client funnels
The CRM SHALL provide one agency board per organization and one board per client, including clients with no projects. A lead and a custom column SHALL each belong to exactly one board. Changing lead details or stage SHALL NOT change its board. Moving leads or columns between boards SHALL NOT be supported in this release.

#### Scenario: Empty client board
- **WHEN** an authorized member opens a client board with no leads, projects or custom columns
- **THEN** the four empty fixed stages and the placeholder column are displayed and permitted creation controls are available

#### Scenario: Board isolation
- **WHEN** a member selects a client board
- **THEN** only leads and custom columns belonging to that client board appear, never the agency's or another client's

### Requirement: Lead identity contacts and acquisition source
A lead SHALL have a required nonblank name and optional company, phone, email, website, source and plain-text notes. Name and company SHALL be limited to 200 characters, phone to 50, email to 254, website to 2048, source to 200 and notes to 10000. Supplied email SHALL be syntactically valid and website SHALL use HTTP or HTTPS. Empty optional strings SHALL normalize to absence. Source SHALL be manually entered text. A lead SHALL be either created by a member or imported from a Meta integration; creating a lead by hand SHALL NOT require any integration. Absent source text SHALL display the imported origin for an imported lead and Не указан otherwise. Duplicate contacts SHALL be allowed, including between imported and hand-made leads.

#### Scenario: Minimal lead
- **WHEN** a member creates a lead with only a name
- **THEN** it is saved with no invented contact or source values

#### Scenario: Contact round trip
- **WHEN** a member saves a lead's contact details, company, source and notes and reopens it
- **THEN** all supplied values are shown and remain editable by authorized members

#### Scenario: Invalid input
- **WHEN** a name is blank, a field exceeds its limit, or a supplied email or website is invalid
- **THEN** the API returns 400 and the form retains entered values with validation feedback

#### Scenario: Source of a hand-made lead left blank
- **WHEN** a member creates a lead without source text
- **THEN** its card shows Не указан as the source

### Requirement: A lead may name the project and campaign it came from
A lead SHALL optionally name one project and one campaign, so that where a prospect came
from is recorded beside their contact details. Both SHALL be optional: a lead that names
neither is a prospect nobody has attributed yet, and that SHALL remain the default.

The offered projects SHALL follow the board. On a client's board only that client's
projects SHALL be offered and accepted; on the agency board every project of the
organization SHALL be. A project the actor cannot reach SHALL be refused as though it did
not exist.

A named campaign SHALL belong to the named project. Naming a campaign without a project,
or a campaign of another project, SHALL be refused. Changing a lead's project SHALL
release a campaign that no longer belongs to it rather than leaving a stale link. Deleting
a project or campaign SHALL leave its leads standing, with the released field empty.

An imported lead SHALL additionally name the ad that produced it, and its project, campaign
and ad SHALL be set by the import alone. A request that changes the project or campaign
of an imported lead SHALL be refused; a request repeating the current values SHALL be
accepted. The lead form SHALL show those choices as read-only for an imported lead.
Deleting the ad SHALL release the ad link and leave the lead standing.

#### Scenario: An unattributed lead
- **WHEN** a member creates a lead naming neither project nor campaign
- **THEN** it is stored with both absent and appears on the board like any other

#### Scenario: The campaign follows the project
- **WHEN** a member chooses a project in the lead form
- **THEN** the campaign choices are that project's campaigns, and no other project's

#### Scenario: A campaign of another project
- **WHEN** a request names a campaign that does not belong to the named project
- **THEN** the API responds 400 and the lead is unchanged

#### Scenario: A project from another board
- **WHEN** a member on client A's board names a project of client B
- **THEN** the API responds 404 and the lead is unchanged

#### Scenario: Changing the project
- **WHEN** a lead's project changes and its campaign belongs to the previous project
- **THEN** the campaign is released and the lead keeps the new project

#### Scenario: The project is deleted
- **WHEN** a project named by a lead is deleted
- **THEN** the lead remains on its board with no project and no campaign

#### Scenario: Re-attributing an imported lead
- **WHEN** a request changes the campaign of an imported lead
- **THEN** the API responds 400 and the lead is unchanged

#### Scenario: Saving an imported lead unchanged
- **WHEN** a member saves an imported lead's form after editing only its notes
- **THEN** the notes are saved and its project, campaign and ad are unchanged

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

### Requirement: Agency board selector and customer default
Agency members SHALL see an upper-left selector containing their available boards, with Агентство first when permitted and client boards named by the client name, even when the client has an organization. When CRM is opened without a board in the address, agency roles SHALL open the board the signed-in person last selected in this browser if they can still reach it, and SHALL otherwise default to the agency board. A board named in the address SHALL take precedence and become the remembered board. The remembered board SHALL belong to the signed-in person, SHALL survive reload, and SHALL NOT be opened for another person signing in on the same browser; a remembered board the person can no longer reach SHALL be forgotten without an error. Customers SHALL open their own board automatically and SHALL NOT see a board selector. Selection SHALL survive reload through the page URL and SHALL clear previous-board cards, dialogs and drag state immediately. Unknown or inaccessible selections named in the address SHALL show an unavailable state without silently creating or editing leads in a different board.

#### Scenario: Client board names
- **WHEN** an agency member opens the selector and client Ромашка has the organization ООО «Цветы»
- **THEN** that client's board is listed as Ромашка

#### Scenario: Switching boards during a request
- **WHEN** agency staff switches from client A to client B before A's request completes
- **THEN** the selector and cards describe B and A's late response does not populate B

#### Scenario: Customer board
- **WHEN** a customer opens CRM
- **THEN** their own board opens with no agency or other-client selection controls

#### Scenario: Returning to CRM from another module
- **WHEN** an agency member selects client A's board, opens another module and returns to CRM through the menu
- **THEN** client A's board opens and the address names it

#### Scenario: A remembered board is no longer reachable
- **WHEN** the board a member last selected is no longer among their boards
- **THEN** CRM opens the default board without an error and no longer remembers the lost one

#### Scenario: Another person on the same browser
- **WHEN** a different person signs in on the browser where client A's board was remembered
- **THEN** CRM opens that person's default board

#### Scenario: The address names a board
- **WHEN** a member opens a CRM address naming client B while client A is remembered
- **THEN** client B's board opens and becomes the remembered board

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

### Requirement: Client removal removes its funnel only
Deleting a client SHALL remove its CRM leads along with existing dependent data, require a confirmation that mentions CRM leads, and preserve audit history under its existing authorization rules. Agency and other client boards SHALL remain unchanged.

#### Scenario: Client deleted
- **WHEN** an admin confirms deletion of a client with leads
- **THEN** that client's board becomes unavailable and its leads are removed without affecting other boards

### Requirement: Imported leads show where they came from
A lead imported from a Meta integration SHALL show, in its detail dialog, a read-only source section containing: the channel Meta and the ad account identifier; the form identifier; the campaign, ad set and ad names recorded at import; the moment the prospect submitted the form; and every kept form answer in form order, with a notice when answers were omitted. When the lead is linked to an ad the member can reach, the section SHALL offer that ad's creative preview. A lead created by a member SHALL show no source section.

On the card, an imported lead with no source text SHALL show `Meta · <campaign name>` as its acquisition source.

The source section SHALL be visible to every member who can read the board and SHALL NOT be writable through the interface or the lead API; contacts, notes and stage of an imported lead SHALL remain editable under the existing permissions.

#### Scenario: Opening an imported lead
- **WHEN** a member opens a lead imported from Meta
- **THEN** the dialog shows the account, form, campaign, ad set, ad, submission time and answers without editing controls for them

#### Scenario: Viewing the creative
- **WHEN** a member opens the creative preview from an imported lead linked to an ad
- **THEN** the ad's creatives are shown as they are from the campaign drill-down

#### Scenario: Card source
- **WHEN** an imported lead from campaign "Весна" has no source text
- **THEN** its card reads `Meta · Весна` where the source is shown

#### Scenario: Manual lead
- **WHEN** a member opens a lead they created by hand
- **THEN** no source section is shown

#### Scenario: Editing an imported lead's contacts
- **WHEN** an authorized member corrects the phone of an imported lead
- **THEN** the phone changes and the recorded source and answers are unchanged

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

### Requirement: Period lead counts per project and fixed stage
The API SHALL report, for an inclusive `from`/`to` range of calendar days, how many leads of each project arrived within the range and are currently in each fixed stage: `NEW`, `QUALIFIED`, `TARGET` and `PROPOSAL`. A lead imported from a Meta form SHALL arrive at its form submission time; any other lead SHALL arrive at its creation time. Days SHALL be UTC calendar days. Only leads attributed to a project SHALL be counted, and leads in custom columns SHALL NOT be counted in any stage. Counts SHALL include only leads on boards the requesting member can reach, and responses SHALL carry project ids and counts only, never lead contact data. A missing, malformed or reversed range SHALL return 400.

#### Scenario: Counting arrivals by current stage
- **WHEN** a project has one lead created in the range that was moved from Новый to КП, and one lead created in the range still in Новый
- **THEN** the project's counts are one for `NEW` and one for `PROPOSAL`, and zero for `QUALIFIED` and `TARGET`

#### Scenario: Arrivals outside the range
- **WHEN** a lead was created the day before the range starts or the day after it ends
- **THEN** it is not counted

#### Scenario: A Meta lead imported after the range
- **WHEN** a Meta lead was submitted on the last day of the range and imported the next day
- **THEN** it is counted in that range

#### Scenario: Leads outside the fixed stages or projects
- **WHEN** a lead sits in a custom column, or has no project
- **THEN** it is not counted in any stage

#### Scenario: Unreachable boards
- **WHEN** a member whose grant covers only one project of a client requests counts
- **THEN** leads on that client's board are not counted for them

#### Scenario: Invalid range
- **WHEN** a request omits `to`, uses a malformed day or sets `from` after `to`
- **THEN** the API responds 400

### Requirement: The dashboard project table offers CRM stage columns
The dashboard's project table column chooser SHALL offer the columns Лид (Новый), Лид (Квалифицированный), Лид (Целевой) and Лид (КП) after the advertising figures. They SHALL be hidden until a member turns them on, and the member's choice SHALL be remembered with the table's other visible columns. Each cell SHALL show the period lead count of that project and stage for the dashboard's selected period, and 0 when there are none. Changing the period SHALL update the counts. The project page's campaign table and the campaign page's tables SHALL NOT offer these columns.

#### Scenario: Turning a stage column on
- **WHEN** a member turns on Лид (Целевой) in the dashboard project table
- **THEN** each project row shows how many of its leads that arrived in the selected period are now in Целевой

#### Scenario: Hidden by default
- **WHEN** a member who never changed the dashboard project table's columns opens the dashboard
- **THEN** the four CRM stage columns are offered in the column chooser but not shown

#### Scenario: Remembered choice
- **WHEN** a member turns on Лид (КП) and later returns to the dashboard
- **THEN** the Лид (КП) column is still shown

#### Scenario: Other tables
- **WHEN** a member opens the column chooser of a project's campaign table
- **THEN** no CRM stage columns are offered
