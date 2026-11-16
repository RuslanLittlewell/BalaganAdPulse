## ADDED Requirements

### Requirement: A task remembers when it was done

The system SHALL record the moment a task enters the `DONE` column and SHALL keep it while the
task stays there. Reordering tasks inside `DONE` SHALL NOT change the moment of a task already
in it, and a task that leaves `DONE` SHALL lose it, so a task that is reopened and done again
starts its day anew.

#### Scenario: Reordering the done column
- **WHEN** another task is dragged to a new position in `DONE`
- **THEN** the tasks already in `DONE` keep the moment they entered it

#### Scenario: Doing a task again
- **WHEN** a task is moved out of `DONE` and back into it
- **THEN** its day in `DONE` is counted from the second move

### Requirement: A done task is archived a day after it was done

A task that has stayed in `DONE` for 24 hours SHALL be moved to the first position of the archive
column without anybody acting, within a few minutes of the 24 hours passing. The move SHALL
stamp `archivedAt` as any other move into the archive does, SHALL close the gap the task leaves
in `DONE`, and SHALL reach the open boards of the members who see the task the way a member's
move does. A task that has been in `DONE` for less than 24 hours SHALL stay there. A task that
was in `DONE` when this rule was introduced SHALL have its 24 hours counted from that moment.

#### Scenario: A day in done
- **WHEN** a task has been in `DONE` for 24 hours
- **THEN** it is first in the archive column, its `archivedAt` is set, and the tasks that were
  below it in `DONE` move up by one

#### Scenario: Done this morning
- **WHEN** a task has been in `DONE` for three hours
- **THEN** it is still in `DONE`

#### Scenario: Reopened before the day passed
- **WHEN** a task is moved from `DONE` to `IN_PROGRESS` after 20 hours and 24 hours pass since it
  was done
- **THEN** it is still in `IN_PROGRESS`

#### Scenario: An open board follows the move
- **WHEN** a task is archived this way while a member who sees it has the board open
- **THEN** the card moves to the archive column on their board without a reload

### Requirement: An admin approves a done task into the archive

A card in `DONE` SHALL carry a В архив control for an `ADMIN` and for nobody else. Using it SHALL
move the task to the first position of the archive column as one move that obeys every rule a
dragged move does, so the approval is audited as a move made by that admin. A card in any other
column SHALL carry no such control. A refused approval SHALL leave the task in `DONE` and tell
the admin the move did not happen.

#### Scenario: An admin approves
- **WHEN** an admin uses В архив on a card in `DONE`
- **THEN** the task is first in the archive column, and an audit event records that admin and
  the move from `DONE` to `ARCHIVED`

#### Scenario: A manager is not offered it
- **WHEN** a manager opens the board with a task in `DONE`
- **THEN** the card carries no В архив control

#### Scenario: Only done tasks are approved
- **WHEN** an admin opens the board with a task in `IN_REVIEW`
- **THEN** the card carries no В архив control
