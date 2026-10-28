## MODIFIED Requirements

### Requirement: A comment can tag people

Writing `@` in the comment field SHALL offer an employee every active employee of the
organization other than the author, and a client's person who is named on the task when the
task is shared with the client. It SHALL offer a client's person the active people named on
the task other than themselves, employees and their own client's people alike, and nobody
else. Choosing one SHALL insert their name and tag them. A tagged member SHALL be an active
member of the organization; a client's person SHALL be taggable only on a task shared with the
client that concerns a project they reach. A client's person SHALL tag only people named on
the task.

Everyone who reaches a task SHALL be able to read the people named on it with their names,
so that a client's person, who may not list the organization's members, can tag them.

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

#### Scenario: A client tags a person on the task
- **WHEN** a client of the project types `@` in a comment on a shared task that names the
  manager Анна and the employee Борис, chooses Анна and sends the comment
- **THEN** only Анна and Борис were offered, the comment is saved with Анна tagged, and Анна is
  notified

#### Scenario: A client tags somebody not on the task
- **WHEN** a request from a client tags an employee who is not named on the task
- **THEN** it is refused and no comment is saved

#### Scenario: Reading the people on a task
- **WHEN** a client who reaches a shared task asks for the people named on it
- **THEN** the answer carries each active one's name, and a member who does not reach the
  task is answered as if the task did not exist
