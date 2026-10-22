## ADDED Requirements

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

Writing `@` in the comment field SHALL offer the people who can see the task: its participants,
its creator and the admins. Choosing one SHALL insert their name and tag them. A tagged member
SHALL be an active member of the organization; a client's person SHALL be taggable only on a
task shared with the client that concerns a project they reach. A client's person SHALL NOT tag
anyone.

#### Scenario: Offering people
- **WHEN** a member types `@` in the comment field
- **THEN** the people involved in the task are offered, narrowing as more letters are typed

#### Scenario: Tagging
- **WHEN** a member chooses a person from the offer and sends the comment
- **THEN** the comment shows the person's name marked as a tag

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
