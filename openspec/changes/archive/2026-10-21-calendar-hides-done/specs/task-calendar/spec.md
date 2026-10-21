## ADDED Requirements

### Requirement: Finished tasks are not drawn in the calendar

The task calendar SHALL NOT draw a task that is done or archived. A call, which recurs whatever stage it was left in, SHALL still be drawn by the calls view. A task
closed from the calendar or elsewhere SHALL leave its day at once and SHALL come back when it
is reopened.

#### Scenario: Closing a task from the calendar

- **WHEN** a member ticks Готово on a task that does not repeat
- **THEN** its card leaves the calendar

#### Scenario: Closing a task on the board

- **WHEN** a task shown in the calendar is moved to Готово on the board
- **THEN** the calendar no longer shows it

#### Scenario: Reopening a task

- **WHEN** a done task is moved back to In progress on the board
- **THEN** it is drawn again on its day
