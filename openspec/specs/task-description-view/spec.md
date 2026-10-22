# task-description-view Specification

## Purpose
TBD - created by archiving change task-comments-and-links. Update Purpose after archive.

## Requirements

### Requirement: The description of an existing task opens for reading

The description of an existing task SHALL open as a read view, without the editing toolbar.
A button «Изменить» beside the description's label SHALL make it editable and SHALL then read
«Готово», which returns it to the read view without discarding what was typed. The description
of a task being created SHALL be editable at once and SHALL have no such button. The description
SHALL start no taller than 250px.

#### Scenario: Opening a task
- **WHEN** a member opens an existing task
- **THEN** its description is shown for reading and the editing toolbar is absent

#### Scenario: Changing the description
- **WHEN** a member presses «Изменить»
- **THEN** the description becomes editable and the button reads «Готово»

#### Scenario: Finishing
- **WHEN** a member presses «Готово»
- **THEN** the description is a read view again and keeps what was typed

#### Scenario: Creating a task
- **WHEN** a member opens the form for a new task
- **THEN** the description is editable and there is no «Изменить» button
