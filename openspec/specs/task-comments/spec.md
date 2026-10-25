# task-comments Specification

## Purpose
TBD - created by archiving change task-comments-and-links. Update Purpose after archive.

## Requirements

### Requirement: A task has comments

A member who can reach a task SHALL be able to read its comments, oldest first, and to add a
comment of up to 5000 characters. Each comment SHALL show its author, its text and when it was
written. The author of a comment and an admin SHALL be able to delete it; nobody else SHALL.
Comments SHALL be removed with their task.

#### Scenario: Writing a comment
- **WHEN** a member writes a comment in an opened task
- **THEN** it appears at the end of the task's comments with the member as author

#### Scenario: An empty comment
- **WHEN** a member sends a comment with no text
- **THEN** it is refused

#### Scenario: Someone else's comment
- **WHEN** a member who is neither the author nor an admin deletes a comment
- **THEN** the deletion is refused and the comment stays

#### Scenario: A task nobody can reach
- **WHEN** a member asks for the comments of a task they cannot reach
- **THEN** the task is reported as not found

### Requirement: A comment can tag people

Writing `@` in the comment field SHALL offer every active employee of the organization other
than the author, and a client's person who is named on the task when the task is shared with
the client. Choosing one SHALL insert their name and tag them. A tagged member SHALL be an
active member of the organization; a client's person SHALL be taggable only on a task shared
with the client that concerns a project they reach. A client's person SHALL NOT tag anyone.

#### Scenario: Offering people
- **WHEN** a member types `@` in the comment field
- **THEN** the active employees are offered, narrowing as more letters are typed

#### Scenario: Tagging
- **WHEN** a member chooses a person from the offer and sends the comment
- **THEN** the comment shows the person's name marked as a tag

#### Scenario: Tagging an employee who is not on the task
- **WHEN** a member tags an employee who is not named on the task
- **THEN** the employee is offered and tagged like any other

#### Scenario: Tagging a stranger
- **WHEN** a request tags someone who is not a member of the organization
- **THEN** it is refused

### Requirement: A tagged person is notified

A member tagged in a comment, other than its author, SHALL receive a notification that says they
were mentioned in the task and opens the task. A client's person SHALL receive it only for a
task shared with the client.

#### Scenario: Being tagged
- **WHEN** a member is tagged in a comment by someone else
- **THEN** their notifications list a mention in the task and opening it shows the task

#### Scenario: Tagging oneself
- **WHEN** a member tags themselves
- **THEN** they receive no notification

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
