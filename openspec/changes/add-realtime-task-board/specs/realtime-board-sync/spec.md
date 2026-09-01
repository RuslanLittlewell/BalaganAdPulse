## Purpose

Keeps every member's view of the task board current while they have it open, by
delivering each task change to exactly those members entitled to see it, so that
people working the same board see one another's moves without polling and
without reloading.

## ADDED Requirements

### Requirement: Authenticated realtime connection

The system SHALL expose a WebSocket endpoint that establishes a live task-event
stream, and SHALL accept a connection only from a caller presenting a valid
access token for an active membership. The endpoint SHALL authenticate with the
same credentials as the REST API. A connection whose token is missing, expired,
malformed or unknown SHALL be refused identically, so that the reason cannot be
distinguished from outside.

#### Scenario: Valid token opens the stream

- **WHEN** a member connects presenting a valid access token
- **THEN** the connection is accepted and begins receiving task events for their
  organization

#### Scenario: Rejected credentials

- **WHEN** a caller connects with a missing, expired, malformed or unknown token
- **THEN** the connection is closed without being accepted
- **AND** the close carries the same reason in every case

### Requirement: Task changes are published after commit

The system SHALL publish a task event when a task is created, updated, deleted or
moved, and SHALL publish it only after the change has been committed. A change
that fails or is rolled back SHALL NOT produce an event.

A create, update or move event SHALL carry the stored task, so a recipient can
apply it without making a further request. A delete event SHALL carry the
identifier of the removed task.

#### Scenario: Committed move is published

- **WHEN** a member moves a task to another column and the change commits
- **THEN** a move event carrying the stored task is published

#### Scenario: Rolled-back change is not published

- **WHEN** a task change fails and its transaction is rolled back
- **THEN** no event is published for it

#### Scenario: Deletion is published by identifier

- **WHEN** a task is deleted
- **THEN** a delete event carrying that task's identifier is published

### Requirement: Delivery is restricted to entitled connections

The system SHALL deliver a task event to a connection only when that connection's
member is entitled to read the task, and SHALL evaluate entitlement at delivery
time against the member's current role and grants rather than those held when the
connection opened.

A connection SHALL NOT receive an event for a task in another organization, for a
task under a project the member holds no reach over, or for any task at all when
the member's role does not permit reading tasks. Where a member cannot reach a
task, delivery SHALL be withheld silently: no event, and no notification that one
was withheld.

#### Scenario: Reach governs delivery

- **WHEN** a task changes under a project a connected member holds no grant over
- **THEN** that member's connection receives nothing about it

#### Scenario: Role governs delivery

- **WHEN** a task changes and a connected member's role does not permit reading
  tasks
- **THEN** that member's connection receives nothing about it

#### Scenario: Entitlement is re-evaluated per event

- **WHEN** a member's access is revoked while their connection is open
- **AND** a task they could previously reach changes afterwards
- **THEN** that member's connection does not receive the event

#### Scenario: Organization boundary

- **WHEN** a task changes in one organization
- **THEN** no connection belonging to another organization receives it

### Requirement: The board applies events without refetching

The board SHALL apply a received task event to the task list it is displaying,
so that a change made by another member becomes visible without issuing a
request. The board SHALL NOT refetch the task list in response to completing its
own move; the move's own response is authoritative.

#### Scenario: Another member's move appears

- **WHEN** another member moves a card and the event arrives
- **THEN** the board shows the card in its new column
- **AND** no task list request is made

#### Scenario: Own move does not refetch

- **WHEN** a member's own move completes
- **THEN** the board does not request the task list

#### Scenario: Deletion removes the card

- **WHEN** a delete event arrives for a visible task
- **THEN** that card is removed from the board

### Requirement: Recovery after a dropped connection

The board SHALL re-establish a dropped connection without user action, and SHALL
refetch the task list once on reconnecting, so that changes published while the
connection was down are not lost. Repeated failures to connect SHALL be retried
at a decreasing rate rather than continuously.

#### Scenario: Reconnect closes the gap

- **WHEN** a connection drops and is re-established
- **THEN** the task list is refetched once

#### Scenario: Retries slow down

- **WHEN** connection attempts keep failing
- **THEN** the delay before each further attempt increases up to a bound
