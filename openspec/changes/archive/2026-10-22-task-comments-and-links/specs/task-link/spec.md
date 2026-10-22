## ADDED Requirements

### Requirement: An opened task is in the address

The tasks page and the archive SHALL put the opened task into the address as `task=<id>` and
SHALL take it out when the task is closed. Opening an address that names a task SHALL open that
task once the tasks are loaded. The browser's back button SHALL close an opened task. An address
naming a task the member cannot reach SHALL open nothing.

#### Scenario: Opening a task
- **WHEN** a member opens a task from the board
- **THEN** the address names the task

#### Scenario: Closing a task
- **WHEN** a member closes the task
- **THEN** the address no longer names a task

#### Scenario: Sharing the address
- **WHEN** a member opens an address that names a task they can reach
- **THEN** the task opens and the address keeps naming it

#### Scenario: Back button
- **WHEN** a member presses the browser's back button with a task opened
- **THEN** the task closes

#### Scenario: An unreachable task
- **WHEN** a member opens an address naming a task they cannot reach
- **THEN** no task opens
