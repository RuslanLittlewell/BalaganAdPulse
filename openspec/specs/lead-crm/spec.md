# lead-crm Specification

## Purpose

Track prospects, their contact details and acquisition sources through one sales funnel per project, with a familiar Kanban interface.

## Requirements

### Requirement: Lead identity contacts and acquisition source
A lead SHALL have a required nonblank name and optional company, phone, email, website, Telegram, messenger, service, source, plain-text notes, deal amount and tags. Name and company SHALL be limited to 200 characters, phone to 50, email to 254, website to 2048, Telegram and messenger to 100, service and source to 200, and notes to 10000. Supplied email SHALL be syntactically valid and website SHALL use HTTP or HTTPS. Empty optional strings SHALL normalize to absence. Source SHALL be manually entered text. A lead SHALL be either created by a member or imported from a Meta integration; creating a lead by hand SHALL NOT require any integration. Absent source text SHALL display the imported origin for an imported lead and Не указан otherwise. Duplicate contacts SHALL be allowed, including between imported and hand-made leads.

#### Scenario: Minimal lead
- **WHEN** a member creates a lead with only a name
- **THEN** it is saved with no invented contact or source values, no amount and no tags

#### Scenario: Contact round trip
- **WHEN** a member saves a lead's contact details, company, Telegram, messenger, service, source and notes and reopens it
- **THEN** all supplied values are shown and remain editable by authorized members

#### Scenario: Invalid input
- **WHEN** a name is blank, a field exceeds its limit, or a supplied email or website is invalid
- **THEN** the API returns 400 and the form retains entered values with validation feedback

#### Scenario: Source of a hand-made lead left blank
- **WHEN** a member creates a lead without source text
- **THEN** its card shows Не указан as the source

### Requirement: CRM uses the task board visual language
The CRM SHALL appear in navigation at `/crm`. It SHALL use the task board's column panels, card styling, spacing, scroll behavior, drag overlay and keyboard drag affordance. Each card SHALL show name, supplied company and contact details, and the lead's tags, and SHALL NOT show its acquisition source or campaign. A lead without tags SHALL show no tag row. Long values SHALL truncate on the card and be readable in the lead card. Empty contacts SHALL NOT produce blank rows on the board card. Notes SHALL be editable in the lead card as its description. Contact actions SHALL NOT initiate a drag or accidentally open the editor. The lead card's stage choice SHALL offer every fixed stage and custom column of the lead's board in board order.

#### Scenario: Opening a card
- **WHEN** a member clicks or keyboard-opens a lead card
- **THEN** the two-column lead card shows the lead's fields and stage, with editing controls only when permitted

#### Scenario: Narrow display
- **WHEN** the viewport cannot fit every column
- **THEN** columns scroll horizontally and each column's cards scroll vertically within the available board height

#### Scenario: Stage choice with custom columns
- **WHEN** a member opens a lead on a board with a custom column Встреча
- **THEN** the stage choice lists Новый, Квалифицированный, Целевой, КП and Встреча in that order

#### Scenario: Tags on the board card
- **WHEN** a lead carries the tags Срочно and VIP
- **THEN** its board card shows Срочно and VIP where the source used to be

### Requirement: Stable atomic ordering and deletion
Leads SHALL have stable ordering per board and per fixed stage or custom column, and custom columns SHALL have stable contiguous ordering per board. Creation SHALL prepend, placing the new lead first in its stage or column and shifting the leads already there down by one; editing SHALL preserve order; moving SHALL atomically update stage and position together with affected neighbors. Out-of-range positive positions given to an explicit move SHALL append; negative or noninteger positions SHALL return 400. Concurrent moves SHALL preserve unique contiguous ordering. The UI SHALL show moves optimistically and restore authoritative state with feedback after failure. Deleting a lead SHALL require confirmation and close the ordering gap.

Every lead stored before this ordering rule took effect SHALL be renumbered once, per board and per fixed stage or custom column, newest `createdAt` first, so existing boards read newest-first immediately rather than only for leads created afterwards. This renumbering SHALL NOT change any lead's stage, column or other field, and SHALL NOT produce an audit event.

#### Scenario: A new lead is placed first
- **WHEN** a member creates a lead in a stage or column that already holds leads
- **THEN** the new lead is first and the existing leads keep their relative order, each one position further back

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

#### Scenario: Existing boards are reordered once
- **WHEN** a board held leads created under the previous append ordering before this change
  shipped
- **THEN** after the migration, that stage or column lists them newest-`createdAt`-first, with
  no other field of any lead changed

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

### Requirement: Imported leads show where they came from
A lead that arrived through an integration SHALL offer, in the right column of its card, a Доп. информация tab holding everything the integration delivered, read-only: the channel Meta and the ad account identifier; the form identifier; the campaign, ad set and ad names recorded at import; the moment the prospect submitted the form; and every kept form answer in form order, with a notice when answers were omitted. When the lead is linked to an ad the member can reach, the tab SHALL offer that ad's creative preview. A lead created by a member SHALL offer no such tab.

The board card SHALL NOT name the Meta campaign an imported lead came from.

The integration's data SHALL be visible to every member who can read the board and SHALL NOT be writable through the interface or the lead API; contacts, notes and stage of an imported lead SHALL remain editable under the existing permissions.

#### Scenario: Opening an imported lead
- **WHEN** a member opens a lead imported from Meta and chooses Доп. информация
- **THEN** the tab shows the account, form, campaign, ad set, ad, submission time and answers without editing controls for them

#### Scenario: Viewing the creative
- **WHEN** a member opens the creative preview from an imported lead linked to an ad
- **THEN** the ad's creatives are shown as they are from the campaign drill-down

#### Scenario: Card source
- **WHEN** an imported lead from campaign "Весна" is shown on the board
- **THEN** its board card does not mention Весна or Meta

#### Scenario: Manual lead
- **WHEN** a member opens a lead they created by hand
- **THEN** no Доп. информация tab is offered

#### Scenario: Editing an imported lead's contacts
- **WHEN** an authorized member corrects the phone of an imported lead
- **THEN** the phone changes and the recorded source and answers are unchanged

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

### Requirement: Four fixed stages and the board's own columns, in either order

Every board SHALL show four fixed stages, always in the same relative order: `NEW` (Новый),
`QUALIFIED` (Квалифицированный), `TARGET` (Целевой), `PROPOSAL` (КП). Fixed stages SHALL NOT
be renamed, deleted, or moved relative to one another. A board's custom columns SHALL each sit
in exactly one of the five positions this creates — before `NEW`, between `NEW` and
`QUALIFIED`, between `QUALIFIED` and `TARGET`, between `TARGET` and `PROPOSAL`, or after
`PROPOSAL` — and SHALL keep their stored order within that position. A placeholder column
with a dashed border and a plus sign, named Добавить столбец, SHALL always be shown last, after
every fixed stage and every custom column, for members who may manage the board's columns.

New leads SHALL default to `NEW`. Members SHALL be able to move leads directly between any
fixed stage or custom column of the same board, wherever that column sits. Qualification SHALL
remain a manual decision without mandatory fields or automatic checks.

#### Scenario: New lead
- **WHEN** a member creates a lead without specifying a stage
- **THEN** it appears last in Новый

#### Scenario: A custom column between two fixed stages
- **WHEN** a board has a custom column Встреча positioned between `NEW` and `QUALIFIED`
- **THEN** the board shows Новый, Встреча, Квалифицированный, Целевой, КП, in that order

#### Scenario: A custom column before the first fixed stage
- **WHEN** a board has a custom column Заявка positioned before `NEW`
- **THEN** the board shows Заявка first, followed by Новый, Квалифицированный, Целевой, КП

#### Scenario: Unknown stage
- **WHEN** a request names a stage that is neither a fixed stage nor a column of that board
- **THEN** the API responds 400 without storing changes

#### Scenario: A column of another board
- **WHEN** a request moves a lead into a custom column that belongs to another board
- **THEN** the API responds 400 and the lead is unchanged

#### Scenario: Moving between fixed and custom columns
- **WHEN** a lead is moved from КП into a custom column and back
- **THEN** only its stage, ordering, update metadata and history change

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
Every lead SHALL belong to the project of the board it was created on, and SHALL keep that project for as long as it exists. A request SHALL NOT choose or change a lead's project; a request naming one SHALL be refused with 400. A lead SHALL optionally name one campaign, which SHALL belong to the board's project. The lead card SHALL offer neither a project nor a campaign choice.

An imported lead's campaign and ad SHALL be set by the import alone. A request that changes the campaign of an imported lead SHALL be refused; a request repeating the current value SHALL be accepted. Deleting a campaign or ad SHALL leave its leads standing, with the released field empty.

#### Scenario: A lead created on a board
- **WHEN** a member creates a lead on project A's board
- **THEN** it is stored as project A's lead and the card offered no project choice

#### Scenario: The campaign choices
- **WHEN** a member opens a lead card on project A's board
- **THEN** no campaign choice is offered

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
- **WHEN** a member saves an imported lead's card after editing only its notes
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

### Requirement: The lead card has two columns
Opening a stored lead SHALL show a card with two columns; creating a lead SHALL show the left column alone. The left column SHALL show, from the top: the stage choice; the lead's name as the heading, typed in when creating; one labelled row per field in this order — Сумма сделки, Ответственный, Компания, Метки, Услуга, Номер телефона, Telegram, Мессенджер, Email, Сайт, Источник; and the description. The card SHALL offer no campaign choice. The right column SHALL offer the tabs Активность and Файлы, and, for a lead that arrived through an integration, Доп. информация; no other tab. A new lead SHALL be stored only when the member presses Создать, after which the card shows it as a stored lead with both columns; an opened lead's changes SHALL be stored only when the member presses Сохранить. Members who may not edit leads SHALL see every value and no editing control. On a narrow screen the columns SHALL stack.

#### Scenario: Creating a lead
- **WHEN** a member opens the create control, types a name and a phone, and presses Создать
- **THEN** one lead is stored with that name and phone and the card shows it as a saved lead

#### Scenario: Creating shows one column
- **WHEN** a member is creating a lead that is not yet stored
- **THEN** only the left column is shown, and no activity, files or tab are offered

#### Scenario: The field order
- **WHEN** a member opens a lead
- **THEN** the rows read Сумма сделки, Ответственный, Компания, Метки, Услуга, Номер телефона, Telegram, Мессенджер, Email, Сайт, Источник, and no campaign choice is offered

#### Scenario: The tabs of a hand-made lead
- **WHEN** a member opens a lead a member created
- **THEN** the right column offers Активность and Файлы and no Доп. информация

#### Scenario: A guest
- **WHEN** a guest opens a lead
- **THEN** every value is shown, the files can be downloaded, and nothing can be changed, attached or removed

### Requirement: A lead carries a deal amount
A lead SHALL optionally carry a nonnegative deal amount with up to four decimal places. The card SHALL show it as a number with no currency sign. The API SHALL exchange the amount as a decimal string, never a float. A negative, malformed or out-of-range amount SHALL be refused with 400.

#### Scenario: Entering an amount
- **WHEN** a member enters 1500,50 as the deal amount and saves
- **THEN** the lead stores 1500.5000 and the card shows 1500.5 with no currency sign

#### Scenario: A negative amount
- **WHEN** a request sets the amount to -1
- **THEN** the API responds 400 and the lead is unchanged

### Requirement: Leads carry tags
A lead SHALL carry up to 10 tags. A tag SHALL be trimmed, nonblank and at most 30 characters, and a lead SHALL NOT carry two tags equal without regard to case. When adding a tag, the card SHALL suggest the tags already used on the same board. Tags SHALL be removable one by one.

#### Scenario: Adding a tag
- **WHEN** a member adds the tag Срочно to a lead and saves
- **THEN** the lead carries Срочно and another lead on the board is offered Срочно when a tag is added to it

#### Scenario: A duplicate tag
- **WHEN** a request gives a lead the tags Срочно and срочно
- **THEN** the API responds 400 and the lead is unchanged

### Requirement: Files are attached to a lead
A member who may edit leads SHALL be able to attach files of any type up to 20 MB each to a stored lead, and to remove them. Every member who can read the board SHALL be able to list a lead's files — name, size, who added it and when — and download them. A file SHALL always be downloaded as an attachment under its original name and SHALL never be rendered by the application's origin. File bytes SHALL be kept in object storage, not in the database. Deleting a lead SHALL delete its files. Adding or removing a file SHALL be audited against the lead and SHALL notify open boards.

#### Scenario: Attaching a file
- **WHEN** a member attaches Договор.pdf to a lead
- **THEN** it is listed on the lead's Файлы tab with its size, the member's name and the time, and downloads as Договор.pdf

#### Scenario: A file too large
- **WHEN** a member attaches a 25 MB file
- **THEN** the API responds 400 and nothing is stored

#### Scenario: A file on another board
- **WHEN** a member requests a file of a lead on a board they cannot reach
- **THEN** the API responds 404

#### Scenario: The lead is deleted
- **WHEN** a lead with two files is deleted
- **THEN** its files can no longer be listed or downloaded

### Requirement: A lead's activity is listed
The lead card's Активность tab SHALL list what happened to the lead, newest first: its creation by a member or its import from Meta, each change of a field with the value before and after, each stage move with the stage names, and each file added or removed with its name. Each entry SHALL name who made it and when; an imported lead's arrival SHALL name no member. The list SHALL be visible to every member who can read the board.

#### Scenario: Reading the history
- **WHEN** a member creates a lead, another changes its phone and then moves it to КП
- **THEN** the activity lists the move to КП, then the phone change with the old and new number, then the creation, each with its member and time

#### Scenario: An imported lead
- **WHEN** a member opens the activity of a lead imported from Meta
- **THEN** its first entry says it arrived from Meta at the form's submission time, naming no member

#### Scenario: A file added
- **WHEN** a member attaches Смета.xlsx to a lead
- **THEN** the activity shows that member added Смета.xlsx

### Requirement: Creating and deleting a lead are confirmed
A lead stored through Создать SHALL raise the success alert Лид создан, and a lead deleted through the card SHALL raise the success alert Лид удалён, each announced as a status outside the card. A refused create or delete SHALL raise its error alert instead and no success alert.

#### Scenario: A lead is created
- **WHEN** a member creates a lead from the card
- **THEN** the alert Лид создан is shown

#### Scenario: A lead is deleted
- **WHEN** a member confirms deleting a lead
- **THEN** the card closes and the alert Лид удалён is shown

#### Scenario: A refused create
- **WHEN** creating a lead is refused
- **THEN** the error is shown and Лид создан is not
