## MODIFIED Requirements

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
