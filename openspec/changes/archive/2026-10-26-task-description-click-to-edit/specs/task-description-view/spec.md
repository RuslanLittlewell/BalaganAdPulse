## MODIFIED Requirements

### Requirement: The description of an existing task opens for reading

The description of an existing task SHALL open as a read view, without the editing toolbar.
A button «Изменить» beside the description's label SHALL make it editable and SHALL then read
«Готово», which returns it to the read view without discarding what was typed. A click on the
read view, on its text or the space around it, SHALL make it editable as «Изменить» does, with
the caret where the click landed, or at the end of the text when the click landed past it. A
click on a link in the read view SHALL open the link, and a click on an attachment SHALL open
its preview, without making the description editable; nor SHALL a click that ends selecting
text. The description of a task being created SHALL be editable at once and SHALL have no such
button. The description SHALL start no taller than 250px.

#### Scenario: Opening a task
- **WHEN** a member opens an existing task
- **THEN** its description is shown for reading and the editing toolbar is absent

#### Scenario: Changing the description
- **WHEN** a member presses «Изменить»
- **THEN** the description becomes editable and the button reads «Готово»

#### Scenario: Clicking the description
- **WHEN** a member clicks the text of the description or the space around it
- **THEN** the description becomes editable with the caret at that place, and the button reads «Готово»

#### Scenario: Clicking an attachment or a link
- **WHEN** a member clicks an attachment or a link in the description being read
- **THEN** the attachment's preview or the link opens and the description stays a read view

#### Scenario: Selecting text to copy
- **WHEN** a member selects part of the description being read
- **THEN** the description stays a read view

#### Scenario: Finishing
- **WHEN** a member presses «Готово»
- **THEN** the description is a read view again and keeps what was typed

#### Scenario: Creating a task
- **WHEN** a member opens the form for a new task
- **THEN** the description is editable and there is no «Изменить» button
