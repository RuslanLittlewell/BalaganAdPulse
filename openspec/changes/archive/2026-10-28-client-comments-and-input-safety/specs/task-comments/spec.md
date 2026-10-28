## MODIFIED Requirements

### Requirement: A task has comments

A member who can reach a task SHALL be able to read its comments, oldest first, and to add a
comment of up to 5000 characters. This SHALL include a `CLIENT` or `CLIENT_ADMIN` on every task
they reach, in the same form an admin sees, whether or not they may change the task. Each
comment SHALL show its author's name, its text and when it was written. The API SHALL send the
author's name with each comment, so a reader who may not list the organization's members — a
client — still sees who wrote it. The author of a comment and an admin SHALL be able to delete it; nobody else SHALL.
Comments SHALL be removed with their task.

#### Scenario: Writing a comment
- **WHEN** a member writes a comment in an opened task
- **THEN** it appears at the end of the task's comments with the member as author

#### Scenario: A client comments on a task they read
- **WHEN** a client opens a task on a project, which they may not change, and sends a comment
- **THEN** it is stored and shown with their name, and they are offered to edit and delete it

#### Scenario: A client reads who wrote a comment
- **WHEN** a client opens a task a manager commented on
- **THEN** the comment shows the manager's name, not an unknown author

#### Scenario: An empty comment
- **WHEN** a member sends a comment with no text
- **THEN** it is refused

#### Scenario: Someone else's comment
- **WHEN** a member who is neither the author nor an admin deletes a comment
- **THEN** the deletion is refused and the comment stays

#### Scenario: A task nobody can reach
- **WHEN** a member asks for the comments of a task they cannot reach
- **THEN** the task is reported as not found
