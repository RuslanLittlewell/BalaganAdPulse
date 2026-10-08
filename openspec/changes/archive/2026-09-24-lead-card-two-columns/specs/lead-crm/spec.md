## MODIFIED Requirements

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
The CRM SHALL appear in navigation at `/crm`. It SHALL use the task board's column panels, card styling, spacing, scroll behavior, drag overlay and keyboard drag affordance. Each card SHALL show name, supplied company and contact details, and acquisition source. Long values SHALL truncate on the card and be readable in the lead card. Empty contacts SHALL NOT produce blank rows on the board card. Notes SHALL be editable in the lead card as its description. Contact actions SHALL NOT initiate a drag or accidentally open the editor. The lead card's stage choice SHALL offer every fixed stage and custom column of the lead's board in board order.

#### Scenario: Opening a card
- **WHEN** a member clicks or keyboard-opens a lead card
- **THEN** the two-column lead card shows the lead's fields and stage, with editing controls only when permitted

#### Scenario: Narrow display
- **WHEN** the viewport cannot fit every column
- **THEN** columns scroll horizontally and each column's cards scroll vertically within the available board height

#### Scenario: Stage choice with custom columns
- **WHEN** a member opens a lead on a board with a custom column Встреча
- **THEN** the stage choice lists Новый, Квалифицированный, Целевой, КП and Встреча in that order

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

### Requirement: Imported leads show where they came from
A lead that arrived through an integration SHALL offer, in the right column of its card, a Доп. информация tab holding everything the integration delivered, read-only: the channel Meta and the ad account identifier; the form identifier; the campaign, ad set and ad names recorded at import; the moment the prospect submitted the form; and every kept form answer in form order, with a notice when answers were omitted. When the lead is linked to an ad the member can reach, the tab SHALL offer that ad's creative preview. A lead created by a member SHALL offer no such tab.

On the card, an imported lead with no source text SHALL show `Meta · <campaign name>` as its acquisition source.

The integration's data SHALL be visible to every member who can read the board and SHALL NOT be writable through the interface or the lead API; contacts, notes and stage of an imported lead SHALL remain editable under the existing permissions.

#### Scenario: Opening an imported lead
- **WHEN** a member opens a lead imported from Meta and chooses Доп. информация
- **THEN** the tab shows the account, form, campaign, ad set, ad, submission time and answers without editing controls for them

#### Scenario: Viewing the creative
- **WHEN** a member opens the creative preview from an imported lead linked to an ad
- **THEN** the ad's creatives are shown as they are from the campaign drill-down

#### Scenario: Card source
- **WHEN** an imported lead from campaign "Весна" has no source text
- **THEN** its card reads `Meta · Весна` where the source is shown

#### Scenario: Manual lead
- **WHEN** a member opens a lead they created by hand
- **THEN** no Доп. информация tab is offered

#### Scenario: Editing an imported lead's contacts
- **WHEN** an authorized member corrects the phone of an imported lead
- **THEN** the phone changes and the recorded source and answers are unchanged

## ADDED Requirements

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
