## ADDED Requirements

### Requirement: The comment field sends on Enter

The comment field SHALL send the comment when Enter is pressed and SHALL start a new line when
Shift+Enter is pressed. While the offer of people to tag is open, Enter SHALL choose the highlighted
person instead. Enter SHALL send nothing while the field holds only spaces. The field SHALL start at
one line, grow with its text up to a limit and then scroll, and SHALL hold the send control at its
right.

#### Scenario: Sending with Enter
- **WHEN** a member types a comment and presses Enter
- **THEN** the comment is sent and the field is emptied

#### Scenario: A new line
- **WHEN** the member presses Shift+Enter
- **THEN** a new line starts and nothing is sent

#### Scenario: Choosing a person
- **WHEN** the offer of people is open and the member presses Enter
- **THEN** the highlighted person is tagged and nothing is sent

### Requirement: A comment can be edited by its author

The author of a comment SHALL be able to edit its text and tags; nobody else SHALL, admins
included. Editing SHALL load the comment into the comment field under a bar saying «Редактирование»
with the comment's text, and the field SHALL save on Enter and cancel on Escape or the bar's close
control. Pressing the up arrow in an empty field SHALL edit the author's last comment on the task.
An edited comment SHALL keep its place and SHALL be marked «изменено». An edit with no text SHALL be
refused. Tags SHALL be validated as when a comment is written, and only members tagged by the edit
who were not tagged before SHALL be notified.

#### Scenario: Fixing a comment
- **WHEN** the author edits a comment and presses Enter
- **THEN** the comment shows the new text, marked «изменено», in its place

#### Scenario: Cancelling
- **WHEN** the author presses Escape while editing
- **THEN** the comment is unchanged and the field is empty again

#### Scenario: The last comment
- **WHEN** the author presses the up arrow in an empty field
- **THEN** their last comment on the task is loaded for editing

#### Scenario: Someone else's comment
- **WHEN** a member, even an admin, tries to edit a comment they did not write
- **THEN** it is refused and no edit control is offered

#### Scenario: Tagging on edit
- **WHEN** the author adds a tag for Борис to a comment that already tagged Анна
- **THEN** Борис is notified and Анна is not notified again
