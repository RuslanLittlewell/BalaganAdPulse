## ADDED Requirements

### Requirement: A repeating task with a time may be marked as a call

A task SHALL carry whether it is a call, defaulting to not. Only a task with a due date, a time
of day and a repetition other than `NONE` SHALL be a call: a request marking any other task as
a call SHALL be refused. A change that takes the time of day or the repetition away from a
call SHALL leave the task no longer a call rather than be refused.

The task form, when creating a task and when editing one, SHALL offer a `Созвон` switch once
the task has a time of day and repeats, and SHALL NOT offer it otherwise.

A call SHALL NOT be shown on the board, whatever stage it is in: it is found in the `Созвоны`
view of the tasks screen. A card that shows a call elsewhere SHALL mark it as a call.

#### Scenario: Marking a weekly meeting as a call

- **WHEN** a member creates a task due Monday at 10:00, repeating weekly, marked as a call
- **THEN** the task reads back as a call

#### Scenario: A call without a repetition

- **WHEN** a member marks as a call a task due Monday at 10:00 that does not repeat
- **THEN** the API responds 400 and the task is not a call

#### Scenario: A call without a time

- **WHEN** a member marks as a call a task due Monday with no time that repeats weekly
- **THEN** the API responds 400 and the task is not a call

#### Scenario: Stopping the repetition of a call

- **WHEN** a member sets the repetition of a call to `NONE`
- **THEN** the task no longer repeats and is no longer a call

#### Scenario: The form offers the choice when it applies

- **WHEN** a member gives a task a time and then a weekly repetition in the task form
- **THEN** the switch `Созвон` appears, and disappears again when the repetition is set
  back to `Не повторяется`

#### Scenario: A call is not on the board

- **WHEN** a member opens the board while a call sits in `IDEA`
- **THEN** the call is in no column, and is found in `Созвоны`
