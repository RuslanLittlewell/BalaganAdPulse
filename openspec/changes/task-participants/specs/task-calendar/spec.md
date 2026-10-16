## ADDED Requirements

### Requirement: A calendar card names its participants on hover

A full-size task card in the calendar SHALL show the pictures of up to three participants and,
when there are more, how many others there are; each picture SHALL show its member's name in a
tooltip when it is hovered or focused.

#### Scenario: Hovering a participant

- **WHEN** a member hovers Мария's picture on the calendar card of a task Мария takes part in
- **THEN** a tooltip reads Мария

## MODIFIED Requirements

### Requirement: The calendar shows only tasks that have a due date

A task SHALL appear in the calendar exactly on its due day, and only if it has a due date. A
task without one SHALL NOT appear in any day — it is found on the board.

Within a day, tasks with a time of day SHALL be shown first, earliest first, followed by
tasks with no time. A card SHALL show its time when it has one, its priority, its
participants and its checklist progress when it has a checklist, and SHALL be marked
when the task repeats.

A day with no tasks SHALL still be drawn, empty, in its place in the week.

#### Scenario: A task with no due date

- **WHEN** a member opens the calendar while a task without a due date sits in
  `IN_PROGRESS`
- **THEN** that task is in no day of the calendar, and is still on the board

#### Scenario: Order within a day

- **WHEN** a day holds a task due at 15:00, a task due at 12:00 and a task due that day with
  no time
- **THEN** they are shown in that day as 12:00, 15:00, then the one with no time

#### Scenario: An empty day

- **WHEN** no task is due on Sunday of the week being shown
- **THEN** Sunday's column is drawn, empty, after Saturday

#### Scenario: A repeating task is marked

- **WHEN** a day holds a task that repeats weekly
- **THEN** its card is marked as repeating

### Requirement: A compact calendar card tells its details on hover
When the calendar shows a task as a compact card, hovering or focusing the card SHALL show a tooltip with the task's full title, its time, its project and its participants, leaving out what the task does not have. Dragging the card SHALL NOT be prevented by the tooltip.

#### Scenario: Hovering a compact card
- **WHEN** a member hovers a compact card of the task Созвон at 10:00 on project Сайт that Мария takes part in
- **THEN** a tooltip shows Созвон, 10:00, Сайт and Мария

#### Scenario: A full-size card
- **WHEN** a member hovers a full-size card
- **THEN** no details tooltip is shown for the card

## REMOVED Requirements

### Requirement: A calendar card names its assignee on hover

**Reason**: A task no longer has one assignee; the card shows its participants.
**Migration**: See "A calendar card names its participants on hover".
