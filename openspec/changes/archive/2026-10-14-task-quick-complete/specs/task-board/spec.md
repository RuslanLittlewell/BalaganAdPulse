## ADDED Requirements

### Requirement: A task is closed and reopened from its card

Every task card — on the board, in the calendar and in a project's list of work in flight —
SHALL carry a Готово checkbox for a member permitted to change tasks, and SHALL carry none for
anyone else. The checkbox SHALL be ticked exactly when the task is in `DONE`, SHALL expose that
state and the task's title in its accessible name, and SHALL be reachable and toggled from the
keyboard. Toggling it SHALL NOT open the task or start dragging its card.

- Ticking it on a task that does not repeat SHALL move the task to the first position of `DONE`,
  as one move that obeys every rule a dragged move does: it is atomic, renumbers both columns,
  is audited, and is refused for a member who may not change tasks.
- Unticking it on a task in `DONE` SHALL move the task to the first position of `IN_PROGRESS`
  the same way.
- Ticking it on a repeating task that is not in `DONE` SHALL complete the task into its next
  occurrence, leaving it in its column and the checkbox unticked. This SHALL be the only
  completion control a card offers.

The card SHALL be drawn in its new state immediately, without waiting for the response, and a
refused change SHALL restore it and tell the member it did not happen.

#### Scenario: Closing a task from the board

- **WHEN** a manager ticks Готово on a task sitting third in `IN_PROGRESS`
- **THEN** the task is first in `DONE` with its checkbox ticked, and the cards that were below it
  in `IN_PROGRESS` move up by one

#### Scenario: Reopening a task

- **WHEN** a manager unticks Готово on a task in `DONE`
- **THEN** the task is first in `IN_PROGRESS` with its checkbox unticked

#### Scenario: Closing a task from the calendar

- **WHEN** a manager ticks Готово on a calendar card of a task that does not repeat
- **THEN** the task is in `DONE`, stays on its day, and its checkbox is ticked

#### Scenario: Closing a task from a project

- **WHEN** a manager ticks Готово on a task in a project's list of work in flight
- **THEN** the task is in `DONE` and leaves the list

#### Scenario: Completing a weekly call

- **WHEN** a manager ticks Готово on a call repeating weekly, due Wednesday, sitting in
  `IN_PROGRESS`
- **THEN** the call is due the next Wednesday, stays where it was in `IN_PROGRESS`, and its
  checkbox is unticked

#### Scenario: A guest sees no checkbox

- **WHEN** a guest opens the board, the calendar or a project
- **THEN** no card carries a Готово checkbox

#### Scenario: The change is refused

- **WHEN** the server refuses a tick
- **THEN** the card returns to where it was with its checkbox as it was, and the member is told
  the change did not happen

#### Scenario: Ticking does not open the task

- **WHEN** a manager ticks Готово on a card
- **THEN** the task form does not open

#### Scenario: From the keyboard

- **WHEN** a manager moves focus to a card's Готово checkbox and presses Space
- **THEN** the task is closed exactly as a click would close it

#### Scenario: The move is recorded

- **WHEN** a manager closes a task with its checkbox
- **THEN** an audit event records that member, that task, and the move into `DONE`
