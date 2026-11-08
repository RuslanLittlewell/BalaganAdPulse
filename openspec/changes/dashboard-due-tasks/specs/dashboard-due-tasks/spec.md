## Purpose

Show a member the tasks that need their attention soon at the top of the dashboard, so the day starts with what is due and not with a trip to the tasks screen.

## ADDED Requirements

### Requirement: The dashboard lists the viewer's tasks that are due soon

The dashboard SHALL have a block titled Задачи на сегодня и ближайшие дни. The block SHALL be the third of the dashboard's blocks of the first row of cards, after the KPI gauge and Важная информация and before the sources. On wide screens the four blocks SHALL stand in one row. The block SHALL list the tasks that meet all of these conditions:
- the viewer is one of the task's participants, or the viewer created the task and it has no participants;
- the task is not done and not archived;
- the task has a due date;
- the due date, in the viewer's time zone, is before today, today, or within the next two days.

The list SHALL be shown only when the viewer's organization has the tasks module. It SHALL update when tasks change, without a page reload.

#### Scenario: A task due today
- **WHEN** the viewer is a participant of an open task due today
- **THEN** the task is listed and labelled Сегодня

#### Scenario: A task due in two days
- **WHEN** the viewer's open task is due the day after tomorrow
- **THEN** the task is listed with its date

#### Scenario: A task due later
- **WHEN** the viewer's open task is due in three days or more
- **THEN** the task is not listed

#### Scenario: My own task with nobody assigned
- **WHEN** the viewer created an open task that has no participants and is due yesterday
- **THEN** the task is listed and labelled Просрочено

#### Scenario: Someone else's task
- **WHEN** an open task due today lists other members and not the viewer
- **THEN** the task is not listed

#### Scenario: A finished task
- **WHEN** the viewer's task due today is done or archived
- **THEN** the task is not listed

#### Scenario: A task without a date
- **WHEN** the viewer's open task has no due date
- **THEN** the task is not listed

#### Scenario: The time zone of the viewer
- **WHEN** a task is due at 23:30 in its own time zone and that moment is already the next day for the viewer
- **THEN** the task is labelled with the viewer's day

#### Scenario: The place of the block
- **WHEN** the dashboard is shown on a wide screen to a member whose organization has the tasks module
- **THEN** the KPI gauge, Важная информация, the due tasks block and the sources stand in one row in that order

#### Scenario: The tasks module is off
- **WHEN** the organization does not have the tasks module
- **THEN** the dashboard shows no due tasks block, makes no task request, and keeps its other three blocks in one row

### Requirement: Due tasks are ordered and labelled by urgency

Overdue tasks SHALL come first, the oldest due date first. The other tasks SHALL follow by due date, then by due time with tasks that have no time last, then by priority from most to least urgent. An overdue task SHALL be labelled Просрочено with its date. A task due today SHALL be labelled Сегодня, one due tomorrow Завтра, and a later one with its date. A task that has an end time SHALL show the word до and the end time after its day label. The start time SHALL NOT be shown, and a task without an end time SHALL show its day label alone.

#### Scenario: A task with an end time
- **WHEN** a task is due today from 15:00 to 17:30
- **THEN** it is labelled Сегодня до 17:30, without the 15:00

#### Scenario: A task without an end time
- **WHEN** a task is due today at 15:00 and has no end time
- **THEN** it is labelled Сегодня, with no time

#### Scenario: Overdue first
- **WHEN** one task was due three days ago and another is due today at 09:00
- **THEN** the overdue task is listed first and labelled Просрочено

#### Scenario: Same day by time
- **WHEN** two tasks are due today, at 15:00 and at 09:00
- **THEN** the 09:00 task is listed first

#### Scenario: Same time by priority
- **WHEN** two tasks are due today at the same time, one urgent and one low
- **THEN** the urgent task is listed first

### Requirement: Each listed task carries a priority marker

Each listed task SHALL have a marker on the left of its row, colored by the task's priority with the colors the task board uses: red for Срочный, amber for Высокий, blue for Средний and gray for Низкий. The color SHALL NOT be the only carrier of the priority: the priority name SHALL be available as text to screen readers and as a tooltip on the marker.

#### Scenario: The priority marker
- **WHEN** a task with the priority Срочный and one with Низкий are listed
- **THEN** each row has a colored marker on its left that follows the same priority colors as the task board, and the priority is also available to screen readers as text

### Requirement: A listed task opens on the tasks screen

Each listed task SHALL be a link to the tasks screen with that task opened. The link SHALL be reachable and activatable from the keyboard and SHALL have the task's title as its name.

#### Scenario: Open a task
- **WHEN** the viewer activates a listed task
- **THEN** the tasks screen opens with that task's panel

### Requirement: The task list reports its own state

While tasks load, the list SHALL show a loader. When none is due, it SHALL say that nothing is due soon. When tasks cannot be read, it SHALL say so and offer a retry. The state SHALL be shown inside the due tasks block and SHALL NOT affect the other blocks.

#### Scenario: Nothing due
- **WHEN** the viewer has no task meeting the conditions
- **THEN** the block says nothing is due soon

#### Scenario: Tasks fail to load
- **WHEN** reading the tasks fails
- **THEN** the block says so with a retry control
