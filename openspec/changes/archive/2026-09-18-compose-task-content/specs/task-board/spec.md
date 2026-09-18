## ADDED Requirements

### Requirement: A task is composed from the blocks of content it is given

The task form SHALL open showing only a title, a description, a project and a priority. The
due date, the checklist, the responsible member and the campaign SHALL NOT be shown until
they are asked for.

A row of controls under the title SHALL offer each block a task does not yet show —
`Даты`, `Чек-лист`, `Ответственный` and `Кампания`. Choosing one SHALL show that block and
SHALL take it out of the row, so a block is never offered twice. A block whose task already
carries a value SHALL be shown from the start and SHALL NOT be offered in the row.

A shown block SHALL be removable, and removing it SHALL clear what it held, so what the
form shows and what the task carries never disagree. Attachments SHALL keep their own place
and SHALL NOT be part of the row.

#### Scenario: A new task starts bare

- **WHEN** a member opens the form to create a task
- **THEN** the title, the description, the project and the priority are shown, and no due
  date, checklist, responsible member or campaign is

#### Scenario: Adding a block

- **WHEN** a member chooses `Чек-лист` from the row
- **THEN** the checklist block appears and `Чек-лист` is no longer offered in the row

#### Scenario: A task that already carries a value

- **WHEN** a member opens a task that is due on 25 September and has two checklist items
- **THEN** both blocks are shown, and neither `Даты` nor `Чек-лист` is offered in the row

#### Scenario: Removing a block clears it

- **WHEN** a member removes the `Даты` block from a task due on 25 September at 12:00 that
  repeats weekly, and saves
- **THEN** the task is stored with no due date, no time of day and no repetition, and
  `Даты` is offered in the row again

#### Scenario: Removing the responsible member

- **WHEN** a member removes the `Ответственный` block from an assigned task and saves
- **THEN** the task is stored with nobody responsible

#### Scenario: Attachments are not a block

- **WHEN** a member opens the form to create a task
- **THEN** the attachments block is in its usual place and the row offers no control for it

### Requirement: A task's checklist is given whole with the task

Creating and updating a task SHALL accept the whole checklist, in the order it is to be
shown, and SHALL store it as given: items no longer present are gone, items present are kept
in that order with the ticks they are given. The task and its checklist SHALL be written in
one transaction, so a refused request leaves neither changed and a task never carries half of
a checklist.

Each item SHALL carry a non-empty title and SHALL be ticked or not, starting unticked. A
request naming an item with a blank title SHALL be refused as a whole. A request that names
no checklist at all SHALL leave the task's checklist as it is.

An item SHALL NOT be addressable on its own: there is no way to add, change, reorder or
remove one item without the task it belongs to.

#### Scenario: Creating a task with a checklist

- **WHEN** a member creates a task naming three checklist items
- **THEN** the task is stored with those three items, in that order, none of them ticked

#### Scenario: Creating a task without one

- **WHEN** a member creates a task naming no checklist
- **THEN** the task is stored with an empty checklist

#### Scenario: Replacing a checklist

- **WHEN** a member updates a task of three items, naming two of them in the other order with
  the first one ticked
- **THEN** the task carries those two items in the order given, the first ticked, and the
  third is gone

#### Scenario: Leaving a checklist alone

- **WHEN** a member updates a task's title and names no checklist
- **THEN** the task keeps every item it had, in its order, with its ticks

#### Scenario: Emptying a checklist

- **WHEN** a member updates a task naming an empty checklist
- **THEN** the task is stored with no items

#### Scenario: A blank item refuses the whole request

- **WHEN** a member creates or updates a task naming an item whose title is only whitespace
- **THEN** the API responds 400 and neither the task nor its checklist is changed

#### Scenario: A refused creation leaves no items

- **WHEN** a creation carrying a checklist is refused because the project cannot be reached
- **THEN** no task and no checklist item is stored

#### Scenario: The items come back with the task

- **WHEN** a member creates a task with two items and the board is read
- **THEN** the task carries both items and reports 0 of 2

#### Scenario: One item on its own

- **WHEN** a request addresses a single checklist item
- **THEN** the API offers no such route

## MODIFIED Requirements

### Requirement: A task may carry a checklist

A task SHALL optionally carry an ordered checklist. Each item SHALL have a non-empty title
and SHALL be either ticked or not, starting not ticked. The checklist SHALL be a property of
the task, given whole when the task is created and when it is updated: a change to it SHALL
take effect when the task is saved and not before, exactly as a change to the title does.
Items SHALL read back in the order they were given. Deleting a task SHALL delete its
checklist with it.

The checklist SHALL be reported as the number ticked out of the total, so progress is
visible without opening the task.

#### Scenario: Adding an item

- **WHEN** a member writes "Собрать креативы" into a task's checklist and saves
- **THEN** the item is stored last in the checklist, not ticked

#### Scenario: An item with a blank title

- **WHEN** a member saves a task carrying a checklist item whose title is empty or only
  whitespace
- **THEN** the API responds 400 and the checklist is unchanged

#### Scenario: Ticking an item

- **WHEN** a member ticks the second of three items and saves
- **THEN** that item reads back ticked, the other two unchanged, and the task reports 1 of 3

#### Scenario: A change that is not saved

- **WHEN** a member ticks an item and closes the form without saving
- **THEN** the task's checklist is as it was

#### Scenario: Order survives a reload

- **WHEN** a member saves a checklist with its last item first and reloads
- **THEN** that item is still at the top

#### Scenario: A deleted task takes its checklist

- **WHEN** an admin deletes a task that has four checklist items
- **THEN** the items are gone with it and no longer readable

#### Scenario: Ticking an item does not move the card

- **WHEN** a member ticks an item of a task in `IN_PROGRESS` and saves
- **THEN** the task keeps its column and its position
