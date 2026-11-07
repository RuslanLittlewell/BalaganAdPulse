## REMOVED Requirements

### Requirement: CRM uses the task board visual language
**Reason**: The CRM now follows Twenty's stage board. Columns lose their panels, and cards are built from chosen fields.
**Migration**: See `crm-board-view`. That capability keeps the navigation entry, scrolling, truncation, empty-row rules and contact actions. The stage choice moves to `lead-side-panel`.

### Requirement: The lead card has two columns
**Reason**: A lead now opens in a side panel. Its values save one at a time, and there is no Создать or Сохранить button.
**Migration**: See `lead-side-panel` for the panel, its groups, tabs and editing. Leads are created through + Новый (see `crm-board-view`).

## MODIFIED Requirements

### Requirement: Project board columns are created, renamed, reordered and deleted
A member who may manage leads on a board SHALL be able to create a custom column with a name, rename it, recolor it, move it one place left or right among all of the board's columns — crossing a fixed stage where that is the next position in either direction — and delete it. A newly created column SHALL be placed last, after every fixed stage and every existing custom column, and SHALL be серый. Column names SHALL be trimmed, nonblank, at most 50 characters, and unique on their board without regard to case, including the fixed stage names. A board SHALL hold at most 20 custom columns. Deleting a column SHALL require confirmation stating how many leads it holds, and SHALL move those leads to the end of Новый in their existing order in the same transaction. Columns SHALL belong to one project board and SHALL be removed with it.

#### Scenario: Create a column
- **WHEN** a member activates Добавить столбец and enters Встреча
- **THEN** a gray column Встреча appears after the last column of that board only

#### Scenario: Duplicate name
- **WHEN** a member names a column Целевой or the name of an existing column in any letter case
- **THEN** the API responds 400 and nothing changes

#### Scenario: Rename a column
- **WHEN** a member renames Встреча to Встреча назначена
- **THEN** the column keeps its place and leads under the new name

#### Scenario: Recolor a column
- **WHEN** a member picks синий for Встреча
- **THEN** the column keeps its place, name and leads and shows a blue pill

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
- **WHEN** a request renames, recolors, moves or deletes a fixed stage
- **THEN** the API responds 400 and nothing changes

#### Scenario: Columns of one project only
- **WHEN** a member creates a column on project A's board of a client that also has project B
- **THEN** the column appears on project A's board and not on project B's

### Requirement: Imported leads show where they came from
A lead that arrived through an integration SHALL offer, in its side panel, a Доп. информация tab holding everything the integration delivered, read-only: the channel Meta and the ad account identifier; the form identifier; the campaign, ad set and ad names recorded at import; the moment the prospect submitted the form; and every kept form answer in form order, with a notice when answers were omitted. When the lead is linked to an ad the member can reach, the tab SHALL offer that ad's creative preview. A lead created by a member SHALL offer no such tab.

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

### Requirement: Creating and deleting a lead are confirmed
A lead created through + Новый or Создать SHALL raise the success alert Лид создан, and a lead deleted from its side panel SHALL raise the success alert Лид удалён, each announced as a status. A refused create or delete SHALL raise its error alert instead and no success alert.

#### Scenario: A lead is created
- **WHEN** a member creates a lead through + Новый
- **THEN** the alert Лид создан is shown

#### Scenario: A lead is deleted
- **WHEN** a member confirms deleting a lead from its panel
- **THEN** the panel closes and the alert Лид удалён is shown

#### Scenario: A refused create
- **WHEN** creating a lead is refused
- **THEN** the error is shown and Лид создан is not
