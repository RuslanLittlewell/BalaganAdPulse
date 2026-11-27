## ADDED Requirements

### Requirement: A board names three of its fixed stages
A member who may manage a board's columns SHALL be able to rename `QUALIFIED`, `TARGET` and
`PROPOSAL` on that board from the column menu. `NEW` SHALL keep its name. A new stage name SHALL
follow the rules of a column name. A renamed stage SHALL keep its place, color, leads and stage
identity, so stage counts, campaign tables, imports and integrations treat it as before. The name
SHALL apply to that board only. Renaming a stage to its original name SHALL return it to the
original, which the interface shows in the member's language. The board, the lead table, the
filters, the lead panel, the lead history and the leads listed on a person or an organization
SHALL show the board's name of the stage.

#### Scenario: Rename a fixed stage
- **WHEN** a member renames Целевой to Горячий
- **THEN** the column Горячий keeps its place, color and leads, and the lead panel offers Горячий as a stage

#### Scenario: Новый keeps its name
- **WHEN** a request renames `NEW`
- **THEN** the API responds 400 and nothing changes

#### Scenario: Another board
- **WHEN** a member renames КП to Договор on project A's board
- **THEN** project B's board still shows КП

#### Scenario: Back to the original name
- **WHEN** a member renames Горячий back to Целевой
- **THEN** the stage is shown as Целевой in Russian and as Target in English

#### Scenario: History under the new name
- **WHEN** a lead was moved to Целевой and the stage is then renamed Горячий
- **THEN** the lead history shows the move to Горячий

## MODIFIED Requirements

### Requirement: Four fixed stages and the board's own columns, in either order

Every board SHALL show four fixed stages, always in the same relative order: `NEW` (Новый),
`QUALIFIED` (Квалифицированный), `TARGET` (Целевой), `PROPOSAL` (КП). Fixed stages SHALL NOT
be deleted, recolored or moved relative to one another, and `NEW` SHALL NOT be renamed; the
other three MAY carry a name of the board's own. A board's custom columns SHALL each sit
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
A member who may manage leads on a board SHALL be able to create a custom column with a name, rename it, recolor it, move it one place left or right among all of the board's columns — crossing a fixed stage where that is the next position in either direction — and delete it. A newly created column SHALL be placed last, after every fixed stage and every existing custom column, and SHALL be серый. Column names SHALL be trimmed, nonblank, at most 50 characters, and unique on their board without regard to case, including the board's names of the fixed stages. A board SHALL hold at most 20 custom columns. Deleting a column SHALL require confirmation stating how many leads it holds, and SHALL move those leads to the end of Новый in their existing order in the same transaction. Columns SHALL belong to one project board and SHALL be removed with it.

#### Scenario: Create a column
- **WHEN** a member activates Добавить столбец and enters Встреча
- **THEN** a gray column Встреча appears after the last column of that board only

#### Scenario: Duplicate name
- **WHEN** a member names a column Целевой or the name of an existing column in any letter case
- **THEN** the API responds 400 and nothing changes

#### Scenario: The name of a renamed stage
- **WHEN** Целевой is renamed Горячий and a member names a custom column Горячий
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
- **WHEN** a request recolors, moves or deletes a fixed stage, or renames `NEW`
- **THEN** the API responds 400 and nothing changes

#### Scenario: Columns of one project only
- **WHEN** a member creates a column on project A's board of a client that also has project B
- **THEN** the column appears on project A's board and not on project B's
