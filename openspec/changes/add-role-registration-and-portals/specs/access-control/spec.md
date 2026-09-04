## MODIFIED Requirements

### Requirement: Clients reach only their own client

A `CLIENT` member SHALL reach the client named by their grant and nothing else: its
projects, the campaigns under them, the figures those campaigns measured, and the tasks
on those projects that are marked visible to the client. Every other client, project,
campaign and task in the organization SHALL be answered as not found.

A client SHALL be able to read the task module and raise a task on a project they reach.
They SHALL NOT change or delete a task once it is raised, SHALL NOT change whether a task
is visible to them, and SHALL NOT write anything else: clients, projects, campaigns and
members stay read-only to them.

#### Scenario: A client's projects

- **WHEN** a client opens the projects module
- **THEN** the projects of their own client are listed, and no others

#### Scenario: A client's dashboard

- **WHEN** a client opens the dashboard
- **THEN** the figures shown cover their own projects alone

#### Scenario: A client raising a task

- **WHEN** a client raises a task on a project they reach
- **THEN** it is stored, it appears on their board, and the agency sees it too

#### Scenario: A client editing a task

- **WHEN** a client tries to change or delete a task
- **THEN** the API refuses with 403 and the task is unchanged

#### Scenario: A client reaching for another client's project

- **WHEN** a client opens the address of a project belonging to another client
- **THEN** the answer is 404

#### Scenario: A client reaching for the agency's own task

- **WHEN** a client opens the address of a task on their project that is not marked
  visible to them
- **THEN** the answer is 404
