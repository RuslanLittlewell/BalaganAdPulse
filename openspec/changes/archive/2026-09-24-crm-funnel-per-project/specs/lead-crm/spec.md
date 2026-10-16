## REMOVED Requirements

### Requirement: Separate agency and client funnels
**Reason**: Funnels are kept per project; the agency funnel and client-wide funnels go away.
**Migration**: Replaced by "One funnel per project". Agency leads and leads with no project are deleted by the migration; other leads move to the board of the project they name.

### Requirement: A lead may name the project and campaign it came from
**Reason**: A lead's project is now the project of its board and is no longer chosen separately.
**Migration**: Replaced by "A lead belongs to its board's project and may name a campaign".

### Requirement: Agency board selector and customer default
**Reason**: The selector now lists projects, and customers see it when they have several projects.
**Migration**: Replaced by "Project board selector".

### Requirement: Board columns are created, renamed, reordered and deleted
**Reason**: Columns now belong to a project board, and the one-off ordering rule for columns stored before the move range widened no longer applies: the migration deletes every existing custom column.
**Migration**: Replaced by "Project board columns are created, renamed, reordered and deleted".

### Requirement: Client removal removes its funnel only
**Reason**: Funnels belong to projects; removing a client or a project removes the funnels of the removed projects.
**Migration**: Replaced by "Removing a project removes its funnel".

## ADDED Requirements

### Requirement: Project board columns are created, renamed, reordered and deleted
A member who may manage leads on a board SHALL be able to create a custom column with a name, rename it, move it one place left or right among all of the board's columns — crossing a fixed stage where that is the next position in either direction — and delete it. A newly created column SHALL be placed last, after every fixed stage and every existing custom column. Column names SHALL be trimmed, nonblank, at most 50 characters, and unique on their board without regard to case, including the fixed stage names. A board SHALL hold at most 20 custom columns. Deleting a column SHALL require confirmation stating how many leads it holds, and SHALL move those leads to the end of Новый in their existing order in the same transaction. Columns SHALL belong to one project board and SHALL be removed with it.

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
- **WHEN** a member moves the second of three custom columns, all sitting after `PROPOSAL`, one place left
- **THEN** it becomes the first of those three custom columns and the fixed stages keep their places

#### Scenario: Move a column across a fixed stage
- **WHEN** a member repeatedly moves a custom column sitting after `PROPOSAL` left, past every
  other custom column after `PROPOSAL`
- **THEN** its next move left places it between `TARGET` and `PROPOSAL`

#### Scenario: Move a column to the very start of the board
- **WHEN** a member moves a custom column left until nothing is left to its left
- **THEN** it sits before `NEW`, first on the board

#### Scenario: Delete a column with leads
- **WHEN** a member confirms deleting a column holding three leads
- **THEN** the column disappears and the three leads appear at the end of Новый in their previous order

#### Scenario: Cancel deletion
- **WHEN** a member cancels deleting a column
- **THEN** the column and its leads are unchanged

#### Scenario: Fixed stages cannot be changed
- **WHEN** a request renames, moves or deletes a fixed stage
- **THEN** the API responds 400 and nothing changes

#### Scenario: Columns of one project only
- **WHEN** a member creates a column on project A's board of a client that also has project B
- **THEN** the column appears on project A's board and not on project B's

### Requirement: One funnel per project
The CRM SHALL provide one board per project, including projects with no leads. There SHALL be no agency board and no client-wide board. A lead and a custom column SHALL each belong to exactly one project board. Changing lead details or stage SHALL NOT change its board. Moving leads or columns between boards SHALL NOT be supported. A project moved to another client SHALL keep its board with every lead and column on it.

#### Scenario: Empty project board
- **WHEN** an authorized member opens the board of a project with no leads or custom columns
- **THEN** the four empty fixed stages and the placeholder column are displayed and permitted creation controls are available

#### Scenario: Board isolation
- **WHEN** a member selects the board of project A of a client that also has project B
- **THEN** only leads and custom columns of project A appear, never project B's

#### Scenario: No agency board
- **WHEN** any member lists CRM boards or requests the key `agency`
- **THEN** no agency board is listed and the request for it returns 404

### Requirement: A lead belongs to its board's project and may name a campaign
Every lead SHALL belong to the project of the board it was created on, and SHALL keep that project for as long as it exists. A request SHALL NOT choose or change a lead's project; a request naming one SHALL be refused with 400. A lead SHALL optionally name one campaign, which SHALL belong to the board's project. The lead form SHALL NOT offer a project choice, and SHALL offer the board project's campaigns alone.

An imported lead's campaign and ad SHALL be set by the import alone. A request that changes the campaign of an imported lead SHALL be refused; a request repeating the current value SHALL be accepted. The lead form SHALL show that choice as read-only for an imported lead. Deleting a campaign or ad SHALL leave its leads standing, with the released field empty.

#### Scenario: A lead created on a board
- **WHEN** a member creates a lead on project A's board
- **THEN** it is stored as project A's lead and the form offered no project choice

#### Scenario: The campaign choices
- **WHEN** a member opens the lead form on project A's board
- **THEN** the campaign choices are project A's campaigns, and no other project's

#### Scenario: A campaign of another project
- **WHEN** a request names a campaign that does not belong to the board's project
- **THEN** the API responds 400 and the lead is unchanged

#### Scenario: A request naming a project
- **WHEN** a request to create or update a lead names a project
- **THEN** the API responds 400 and nothing changes

#### Scenario: Re-attributing an imported lead
- **WHEN** a request changes the campaign of an imported lead
- **THEN** the API responds 400 and the lead is unchanged

#### Scenario: Saving an imported lead unchanged
- **WHEN** a member saves an imported lead's form after editing only its notes
- **THEN** the notes are saved and its campaign and ad are unchanged

### Requirement: Project board selector
Members SHALL see an upper-left selector listing the project boards they reach, each named by its project with its client's name beside it, ordered by client name and then by the project's place in its client. The selector SHALL be shown whenever a member reaches more than one board, to customers as well as to agency members; a member with one board SHALL open it without a selector. When CRM is opened without a board in the address, it SHALL open the board the signed-in person last selected in this browser if they can still reach it, and SHALL otherwise open the first listed board. A board named in the address SHALL take precedence and become the remembered board. The remembered board SHALL belong to the signed-in person, SHALL survive reload, and SHALL NOT be opened for another person signing in on the same browser; a remembered board the person can no longer reach SHALL be forgotten without an error. Selection SHALL survive reload through the page URL and SHALL clear previous-board cards, dialogs and drag state immediately. Unknown or inaccessible selections named in the address SHALL show an unavailable state without silently creating or editing leads in a different board. A member who reaches no project SHALL see that there is no board to show.

#### Scenario: Board names
- **WHEN** a member opens the selector and client Ромашка has the projects Сайт and Реклама
- **THEN** both are listed by project name with Ромашка beside each

#### Scenario: A customer with several projects
- **WHEN** a customer whose client has two projects opens CRM
- **THEN** a selector offers exactly those two projects and no other client's

#### Scenario: A customer with one project
- **WHEN** a customer whose client has one project opens CRM
- **THEN** that project's board opens with no selector

#### Scenario: Switching boards during a request
- **WHEN** a member switches from project A to project B before A's request completes
- **THEN** the selector and cards describe B and A's late response does not populate B

#### Scenario: Returning to CRM from another module
- **WHEN** a member selects project A's board, opens another module and returns to CRM through the menu
- **THEN** project A's board opens and the address names it

#### Scenario: A remembered board is no longer reachable
- **WHEN** the board a member last selected is no longer among their boards
- **THEN** CRM opens the first listed board without an error and no longer remembers the lost one

#### Scenario: Another person on the same browser
- **WHEN** a different person signs in on the browser where project A's board was remembered
- **THEN** CRM opens that person's default board

#### Scenario: The address names a board
- **WHEN** a member opens a CRM address naming project B while project A is remembered
- **THEN** project B's board opens and becomes the remembered board

### Requirement: Removing a project removes its funnel
Deleting a project SHALL delete every lead and custom column of its board in the same operation. Deleting a client SHALL do the same for each of its projects. Audit history SHALL be preserved under its existing authorization rules. Other project boards SHALL remain unchanged.

#### Scenario: Project deleted
- **WHEN** an admin deletes a project whose board holds leads and a custom column
- **THEN** that board becomes unavailable, its leads and column are removed, and other boards are unchanged

#### Scenario: Client deleted
- **WHEN** an admin confirms deletion of a client with two projects holding leads
- **THEN** both boards become unavailable and their leads are removed without affecting other clients' boards

## MODIFIED Requirements

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
- **THEN** CRM events about other clients' projects are excluded, including their contact fields

#### Scenario: Imported lead arrives on an open board
- **WHEN** a lead poll commits a new lead to a board a member has open
- **THEN** the card appears without a manual reload and no audit event names a member as its creator
