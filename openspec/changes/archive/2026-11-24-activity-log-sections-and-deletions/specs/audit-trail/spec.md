## MODIFIED Requirements

### Requirement: Reading the trail is scoped like everything else

`GET /api/audit` SHALL return only events the caller may reach, and SHALL support filtering by client, project, campaign, entity, actor and date range, to events tied to any project with `inProject=true`, and to one section with `section=projects`, `section=tasks` or `section=crm`, with cursor pagination. `GET /api/audit/actors` SHALL list the members who are the actor of at least one event the caller may reach, each with their id and current name, ordered by name.

#### Scenario: Manager reads the trail
- **WHEN** a manager granted two clients reads the audit trail without filters
- **THEN** only events belonging to those two clients are returned, newest first

#### Scenario: Who changed this cell
- **WHEN** a member requests the trail filtered to one row of one campaign
- **THEN** the events for that row are returned in reverse chronological order

#### Scenario: Only what concerns projects
- **WHEN** an admin reads the trail with `inProject=true`
- **THEN** only events that carry a project are returned

#### Scenario: One section
- **WHEN** an admin reads the trail with `section=tasks`
- **THEN** only events of tasks that belong to no lead, and of their comments and files, are returned

#### Scenario: A section and a project
- **WHEN** an admin reads the trail with `section=crm` and one project
- **THEN** only that project's CRM events are returned, and no company or person, since those carry no project

#### Scenario: An unknown section
- **WHEN** a request asks for `section=people`
- **THEN** the API responds 400

#### Scenario: Who appears in the trail
- **WHEN** a manager granted one client reads `GET /api/audit/actors`
- **THEN** the list holds the people who acted on that client's events, and nobody who acted only elsewhere

## ADDED Requirements

### Requirement: Events are sorted into sections

Each event SHALL belong to at most one section, decided by what it concerns. The section `tasks` SHALL hold the events of a task, a task comment, a task image or a task document whose task belongs to no lead. The section `crm` SHALL hold the events of a lead, a lead column, a lead field, a lead note, a company and a person, and every event that concerns a lead, which includes a task of a lead and that task's comments and files. The events of a member and of an invitation SHALL belong to no section; these include removing a member, revoking an invitation, resetting a second factor, coming online and going offline. The section `projects` SHALL hold every other event. An event that concerns a lead SHALL carry that lead's id as `leadId`, and every other event SHALL carry `leadId` as null. An event recorded before `leadId` existed SHALL carry the lead when it can still be found: an event of a lead carries that lead, and an event of a task that still exists and belongs to a lead carries that task's lead.

#### Scenario: A task of a lead
- **WHEN** a manager creates a task for a lead
- **THEN** the event carries the lead's id, `section=crm` returns it and `section=tasks` does not

#### Scenario: A comment on a task of a lead
- **WHEN** a manager writes a comment on a task of a lead
- **THEN** the event carries the lead's id and `section=crm` returns it

#### Scenario: A plain task
- **WHEN** a manager deletes a task that belongs to no lead
- **THEN** `section=tasks` returns the event and `section=projects` does not

#### Scenario: A deleted client
- **WHEN** an admin deletes a client
- **THEN** `section=projects` returns the event

#### Scenario: Another event that carries a lead
- **WHEN** a campaign's event carries a lead's id
- **THEN** `section=crm` returns it and `section=projects` does not

#### Scenario: A people event that carries a lead
- **WHEN** an invitation's event carries a lead's id
- **THEN** none of `section=projects`, `section=tasks` and `section=crm` returns it

#### Scenario: Events about people
- **WHEN** an admin removes a member and reads the trail
- **THEN** the event is returned without a section filter and by none of `section=projects`, `section=tasks` and `section=crm`

#### Scenario: An earlier event of a lead's task
- **WHEN** a task of a lead was created before events carried a lead, and the task still exists
- **THEN** its creation event carries the lead's id and `section=crm` returns it

### Requirement: Comments, task files and lead notes are recorded

Writing, editing and deleting a task comment SHALL each write one event about the comment that names its task. Writing, editing and deleting a lead note SHALL each write one event about the note that names its lead. Images and documents attached to a task when the task is created or changed SHALL be named in that create or update event of the task, each document by its name and the images by their number, and SHALL write no event of their own. Removing a task image or a task document SHALL write one deletion event that names the task and, for a document, the document's name. These events SHALL carry the client, the project and the lead of the task or lead they belong to, so the people who read that task's or lead's events read them too. They SHALL NOT copy the text of a comment or a note. A comment or file of a customer's personal task SHALL write no event, and neither SHALL an upload that is not attached to a task. Each event SHALL be committed in the transaction of the change it describes, and a refused request SHALL write none.

#### Scenario: Deleting a comment
- **WHEN** an admin deletes a manager's comment on the task «Подготовить отчёт»
- **THEN** one `DELETE` event is recorded with the admin as actor, naming the task, carrying the task's project, and without the comment's text

#### Scenario: Editing a note
- **WHEN** a manager edits their note on the lead Анна
- **THEN** one `UPDATE` event is recorded that names Анна and carries her project and her id as `leadId`

#### Scenario: Attaching a document
- **WHEN** a manager saves a task with the newly attached document Бриф.pdf
- **THEN** the task's update event names Бриф.pdf, and no other event is recorded

#### Scenario: Removing a document
- **WHEN** a manager removes Бриф.pdf from a task
- **THEN** one `DELETE` event is recorded that names the task and Бриф.pdf

#### Scenario: A personal task
- **WHEN** a client comments on their personal task and removes an image from it
- **THEN** no event is recorded

#### Scenario: A refused deletion
- **WHEN** a manager tries to delete another member's comment and is refused
- **THEN** no event is recorded

### Requirement: Removing a member and revoking an invitation are recorded

Removing a member from the organization SHALL write one deletion event about that member, with their name and the role they held, carrying no client, project or campaign. Revoking an invitation SHALL write one deletion event about the invitation, with its email when it has one and the role or kind of registration it grants, carrying the invitation's client when it names one. Each event SHALL be committed in the transaction of the change, and a refused request SHALL write none.

#### Scenario: Removing a manager
- **WHEN** an admin removes Борис, a manager
- **THEN** one `DELETE` event is recorded that names Борис and the role `MANAGER`, and only readers who reach the whole organization read it

#### Scenario: Revoking a client's invitation
- **WHEN** a client's principal revokes an invitation to their own client
- **THEN** one `DELETE` event is recorded with that client, and the principal reads it in the trail

#### Scenario: Revoking a used invitation
- **WHEN** an admin tries to revoke an invitation that was already used
- **THEN** the API responds 409 and no event is recorded

### Requirement: A deletion counts what went with it

Deleting a client, a project, a lead or a task SHALL write one event for that record and none for the rows the database removes with it. That event SHALL carry how many rows of each kind went with the record, leaving out kinds with none. For a client, the kinds SHALL be its projects, companies and people, and, across its projects, their campaigns, leads, tasks, reports and documents. For a project, the kinds SHALL be its campaigns, leads, tasks, reports and documents. For a lead, the kinds SHALL be its tasks, notes and files. For a task, the kinds SHALL be its comments and its files, images and documents counted together. Tasks of leads SHALL count among the tasks of their project and client. The counts SHALL be taken in the deletion's transaction, before the rows are removed.

#### Scenario: Deleting a project
- **WHEN** an admin deletes a project that holds 12 tasks, 30 leads and nothing else
- **THEN** one `DELETE` event is recorded that counts 12 tasks and 30 leads, and no event of a task or a lead is recorded

#### Scenario: Deleting a lead
- **WHEN** a manager deletes a lead that has two tasks and one note
- **THEN** its `DELETE` event counts 2 tasks and 1 note, and names no files

#### Scenario: Deleting a task with nothing under it
- **WHEN** a manager deletes a task without comments or files
- **THEN** its `DELETE` event carries no counts
