## MODIFIED Requirements

### Requirement: The board shows the work that is the member's own

What a member sees on the board SHALL be narrowed by whose work it is, not only by which
projects they reach:

- An `ADMIN` SHALL see every task in the organization.
- A `MANAGER` or `GUEST` SHALL see only the tasks they are responsible for. There is no
  exception: a task nobody is responsible for is seen by admins alone until one of them
  makes somebody responsible for it.
- A `CLIENT` or `CLIENT_ADMIN` SHALL see only the tasks marked visible to the client, on
  the projects they reach. The two customer roles see the same work: the second
  administers people, not tasks.

Reach still applies first and independently: a task in a project a member cannot reach is
never shown, whoever it belongs to. This rule narrows what remains; it can never widen it.

A task a member cannot see SHALL be answered as not found, never as forbidden, so the
board cannot be used to learn that somebody else's work exists.

#### Scenario: A manager's board

- **WHEN** a manager opens the board on a project they are granted
- **THEN** the tasks they are responsible for are shown, and a colleague's are not

#### Scenario: A task nobody is responsible for

- **WHEN** a task on a granted project has no responsible member
- **THEN** no manager or guest sees it, and every admin does

#### Scenario: An admin hands a task to a manager

- **WHEN** an admin makes a manager responsible for a task that manager could not see
- **THEN** it appears on that manager's board

#### Scenario: A task handed to somebody else

- **WHEN** a manager creates a task and makes a colleague responsible for it
- **THEN** it leaves their board and appears on the colleague's

#### Scenario: An admin's board

- **WHEN** an admin opens the board
- **THEN** every task in the organization is shown, whoever is responsible

#### Scenario: A client's employee sees what the client sees

- **WHEN** a `CLIENT` and the `CLIENT_ADMIN` of the same client each open the task module
- **THEN** both see every task marked visible to the client on their projects, including
  the ones the other raised

#### Scenario: Neither sees the agency's own work

- **WHEN** either opens the address of an unmarked task on their own project
- **THEN** the answer is 404

#### Scenario: Opening somebody else's task directly

- **WHEN** a manager opens the address of a task a colleague is responsible for
- **THEN** the answer is 404, the same answer a task that does not exist gets

#### Scenario: The lists beside the figures follow the same rule

- **WHEN** a member opens a project or a campaign screen
- **THEN** the tasks listed there are the ones their board would show, on the same rule
