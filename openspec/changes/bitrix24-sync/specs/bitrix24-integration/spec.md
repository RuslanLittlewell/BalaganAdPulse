## Purpose

Keep an organization's CRM records and their Bitrix24 counterparts equal in both directions, so a sales team can work in either system without copying between them.

## ADDED Requirements

### Requirement: An administrator connects one Bitrix24 portal

An organization with the CRM module SHALL be able to hold at most one Bitrix24 connection, managed by an ADMIN only. Connecting SHALL take the portal's inbound webhook address and the application token of its outbound webhook. The system SHALL refuse an address that is not an https address of a public host on the default port, SHALL connect to the portal only at a public network address, checked on the address each connection actually uses, SHALL check the address by calling the portal before saving it, and SHALL refuse one the portal rejects. The webhook address and the application token SHALL be stored so that they cannot be read back, and the API SHALL never return them. The administrator SHALL be able to switch the connection off, which stops syncing and keeps the links between records, and to remove it, which stops syncing and forgets the links and the secrets.

#### Scenario: Connecting
- **WHEN** an admin sends a working webhook address and a token
- **THEN** the connection is saved, shows the portal's host and status `ACTIVE`, and the API returns neither secret

#### Scenario: A rejected address
- **WHEN** an admin sends an address that the portal answers with an authorization error
- **THEN** the API responds 400 and stores nothing

#### Scenario: An address that is not public
- **WHEN** an admin sends an `http` address, an address with a port, or one that points at a private network
- **THEN** the API responds 400 and no request is made to it

#### Scenario: A host that moves to a private network
- **WHEN** a portal host resolves to a public address when it is saved and to a private one later
- **THEN** the worker's requests to it are refused before they connect

#### Scenario: Roles
- **WHEN** a manager, a guest or a client asks for the connection or changes it
- **THEN** the API responds 403

#### Scenario: Without the CRM module
- **WHEN** an organization without the CRM module opens the connection endpoints
- **THEN** the API responds 404

#### Scenario: Switching off
- **WHEN** an admin switches the connection off and later on again
- **THEN** records stay linked, and changes made while it was off are not sent

#### Scenario: Removing
- **WHEN** an admin removes the connection
- **THEN** its secrets and links are deleted and the records on both sides stay

### Requirement: Bitrix24 reaches AdPulse through a public webhook

The system SHALL expose one public address per connection for the portal's outbound webhook. The address SHALL carry a random key that names the connection and cannot be guessed. The system SHALL accept an event only when the application token in it equals the stored one, SHALL answer 202 as soon as the event is stored, and SHALL answer an unknown key or a wrong token with the same 404. The address SHALL be limited in rate, and one network address SHALL get 429 for the rest of a minute after 30 refused events in it. Events for a switched-off or removed connection SHALL be ignored.

#### Scenario: A valid event
- **WHEN** the portal sends a lead update with the right key and token
- **THEN** the API responds 202 and the lead is fetched and applied

#### Scenario: A wrong token
- **WHEN** an event arrives with a wrong application token
- **THEN** the API responds 404 and nothing is applied

#### Scenario: An unknown key
- **WHEN** an event arrives at a key that names no connection
- **THEN** the API responds the same 404

#### Scenario: Guessing keys
- **WHEN** one network address sends events to 31 unknown keys within a minute
- **THEN** the 31st and later answers are 429

#### Scenario: Too many events
- **WHEN** one address receives events faster than its limit
- **THEN** the API responds 429 and the portal's retry delivers the rest later

### Requirement: Leads sync in both directions

A lead created or changed in AdPulse after the portal was connected SHALL be created or updated in Bitrix24 with its name, source, amount, stage and description. A lead created or changed in Bitrix24 after the portal was connected SHALL be created or updated in AdPulse with the same fields. Tags SHALL NOT sync, because a Bitrix24 lead has none. Each pair SHALL stay linked after the first sync. A lead that starts in Bitrix24 SHALL be created in the project the administrator chose for inbound leads, and SHALL not be created while none is chosen. A lead SHALL keep its place on the board when only a field the other side does not know changes.

#### Scenario: A lead created in AdPulse
- **WHEN** a member creates a lead on a board of a connected organization
- **THEN** a lead with the same name, amount and stage appears in Bitrix24 and the two are linked

#### Scenario: A lead created in Bitrix24
- **WHEN** a salesperson creates a lead in Bitrix24
- **THEN** a lead appears on the inbound project's board in the column mapped to its status

#### Scenario: An edit in either place
- **WHEN** a member changes a linked lead's amount in AdPulse, and later a salesperson changes its name in Bitrix24
- **THEN** both sides end with the new amount and the new name

#### Scenario: No inbound project
- **WHEN** a lead is created in Bitrix24 while no inbound project is chosen
- **THEN** it is not created in AdPulse and the settings show how many such leads were skipped

### Requirement: Stages map to Bitrix24 statuses

The administrator SHALL map each fixed stage and each board column to one Bitrix24 lead status, and the screen SHALL offer the portal's own statuses to choose from. A lead moved to a stage SHALL be given the mapped status in Bitrix24, and a lead moved to a status SHALL be moved to the mapped stage or column. A stage with no mapping SHALL be reported on the settings screen, and the lead SHALL keep its stage and its status unchanged until it is mapped.

#### Scenario: Moving a lead
- **WHEN** a member moves a lead to a stage mapped to the status «В работе»
- **THEN** the lead in Bitrix24 gets that status

#### Scenario: A status with no stage
- **WHEN** a lead in Bitrix24 moves to a status that no stage maps to
- **THEN** the AdPulse lead keeps its stage and the settings list the unmapped status

### Requirement: Contacts and companies sync in both directions

People and companies SHALL sync with Bitrix24 contacts and companies, with their name, phone, email and website, and SHALL stay attached to the lead they were attached to on either side. A website from Bitrix24 that is not an `http` or `https` address SHALL be dropped, as the API drops it from a member. A contact or company created in Bitrix24 SHALL belong to the client of the inbound project, or to the client of the lead it is attached to.

#### Scenario: A contact on a lead
- **WHEN** a member adds a person to a linked lead
- **THEN** a contact with the same name and phone is created in Bitrix24 and attached to the lead

#### Scenario: A company in Bitrix24
- **WHEN** a salesperson attaches a company to a linked lead in Bitrix24
- **THEN** the company exists in AdPulse under the lead's client and is attached to the lead

### Requirement: Notes and comments sync

Lead notes SHALL sync with the comments in the timeline of the Bitrix24 lead, and task comments with the comments of the Bitrix24 task. A comment written on one side SHALL appear on the other with its text and its author's name in the text when the author has no counterpart. Editing a comment SHALL update its counterpart. Deleting one SHALL NOT delete its counterpart.

#### Scenario: A note becomes a comment
- **WHEN** a member writes a note on a linked lead
- **THEN** the lead's timeline in Bitrix24 shows a comment with that text

#### Scenario: A comment becomes a note
- **WHEN** a salesperson comments on a linked lead in Bitrix24
- **THEN** the lead shows a note with that text, written under the salesperson's name

### Requirement: Lead tasks sync with Bitrix24 tasks

A task that belongs to a lead SHALL sync with a Bitrix24 task bound to the linked lead, with its title, deadline, status and assignee. Its description SHALL be sent to Bitrix24 as plain text, and a Bitrix24 description SHALL fill an AdPulse task only while the task has none, so formatted AdPulse text is never replaced by plain text. An assignee SHALL be matched to the other side by email. When no match exists the task SHALL stay unassigned on the receiving side. A task that belongs to no lead SHALL NOT sync, and a Bitrix24 task bound to nothing SHALL NOT be created in AdPulse. Finishing a task on one side SHALL finish it on the other.

#### Scenario: A lead task
- **WHEN** a member creates a task on a linked lead
- **THEN** a task bound to the lead exists in Bitrix24 with the same deadline

#### Scenario: Finishing in Bitrix24
- **WHEN** a salesperson completes the bound task in Bitrix24
- **THEN** the task moves to done in AdPulse

#### Scenario: A task with no lead
- **WHEN** a member creates a task that belongs to no lead
- **THEN** nothing is sent to Bitrix24

### Requirement: The later change wins and never echoes

When both sides changed the same record, the system SHALL keep the change with the later modification time and overwrite the other. A change applied from one side SHALL NOT be sent back to it. A change the system itself wrote to Bitrix24 SHALL NOT be applied again when the portal reports it.

#### Scenario: Both sides edited
- **WHEN** a lead is renamed in AdPulse at 10:00 and renamed in Bitrix24 at 10:05
- **THEN** both sides end with the Bitrix24 name

#### Scenario: No loop
- **WHEN** the system writes a lead to Bitrix24 and the portal reports the write
- **THEN** the report is recognized and no further write happens

### Requirement: Sync survives failures

A change made in AdPulse SHALL be saved in AdPulse whether or not the portal answers, and a worker SHALL find every record changed since its last sync and send it to Bitrix24, trying again on its next pass while the portal is unreachable or answers with a rate limit or a server error. The worker SHALL stay within the portal's request rate. A change that the portal refuses as invalid SHALL be marked failed with the reason, SHALL NOT be retried until the record changes again, and SHALL NOT block later changes. When the portal answers that the webhook is no longer valid, the connection SHALL be marked `AUTH_REQUIRED`, sending SHALL stop, and the settings SHALL say so. After the administrator saves a working address the worker SHALL resume and send what changed meanwhile.

#### Scenario: The portal is down
- **WHEN** Bitrix24 is unreachable while a member edits a lead
- **THEN** the edit is saved in AdPulse, and it reaches Bitrix24 once the portal answers

#### Scenario: A refused change
- **WHEN** the portal refuses one lead's update as invalid
- **THEN** that change is marked failed with its reason and the next change is sent

#### Scenario: The webhook is revoked
- **WHEN** the portal rejects the stored webhook address
- **THEN** the connection becomes `AUTH_REQUIRED` and the settings ask for a new address

### Requirement: Deleting does not propagate

Deleting a lead, contact, company, note or task on one side SHALL NOT delete its counterpart. The link SHALL be dropped, and a later change to the surviving record SHALL NOT recreate the deleted one.

#### Scenario: A lead deleted in AdPulse
- **WHEN** a member deletes a linked lead
- **THEN** the lead stays in Bitrix24, unlinked

#### Scenario: A lead deleted in Bitrix24
- **WHEN** a salesperson deletes a linked lead in Bitrix24
- **THEN** the lead stays in AdPulse, unlinked

### Requirement: Existing records move on request

Connecting SHALL NOT move existing records. The administrator SHALL be able to run, once each and after a confirmation, an upload of every unlinked AdPulse lead, contact and company to Bitrix24 and a download of every unlinked Bitrix24 lead, contact and company into AdPulse. Each run SHALL show its progress and its count of created and failed records, and SHALL be refused while another run is going. A run SHALL NOT match records by their contents, so a record present on both sides is created a second time.

#### Scenario: Uploading
- **WHEN** an admin confirms the upload
- **THEN** every unlinked lead, contact and company is created in Bitrix24 and linked, and the screen shows the counts

#### Scenario: Two runs at once
- **WHEN** an admin starts a download while an upload is running
- **THEN** the request is refused and the running one continues

### Requirement: An expired trial pauses syncing

The worker SHALL NOT send changes for an organization whose trial has ended, and the webhook SHALL NOT apply events for it. Changes made before or after the end, and events received meanwhile, SHALL wait and be sent and applied once a tariff is assigned.

#### Scenario: After the trial
- **WHEN** an organization's trial has ended
- **THEN** no request goes to its portal and no event is applied

### Requirement: One «Интеграции +» button opens the integrations dialog

The CRM header SHALL show «Интеграции +» in place of the «Web интеграция» button: a button in the same colour and height as «Добавить лид», shown to every member who may manage a project's website key and to every ADMIN. Pressing it SHALL open one modal dialog with two tabs, «Web интеграция» and «Битрикс24», the first one open. The «Web интеграция» tab SHALL hold what the web integration's dialog held, unchanged, for the selected board, and SHALL say that a project must be chosen while none is selected. The «Битрикс24» tab SHALL be offered to an ADMIN only. A member who may not manage Bitrix24 SHALL see the dialog without the tab bar. The button and the dialog SHALL NOT be shown in an organization without the CRM module.

The «Битрикс24» tab SHALL be laid out as the web integration is: sections each with a small heading, a hint line and its controls, with switching off, replacing and removing asked for in a bordered confirmation block that says what will stop working. Before a portal is connected it SHALL show the address and token fields and a «Подключить» button. Once connected it SHALL show, in this order: the status of the connection and of the last sync; the address for the portal's outbound webhook, with a copy control; the mapping of stages to Bitrix24 statuses; the project for leads that start in Bitrix24; the skipped and failed changes with their reasons; the upload and download actions; and the controls to switch the connection off, replace the webhook address and remove the connection. A failed save SHALL keep what was typed and show the error. The copy SHALL be Russian and English from the dictionaries.

#### Scenario: The button
- **WHEN** an admin opens the CRM page of an organization with the CRM module
- **THEN** the header shows «Интеграции +», coloured like «Добавить лид», and no separate «Web интеграция» button

#### Scenario: The two tabs
- **WHEN** an admin presses «Интеграции +»
- **THEN** a modal opens on the «Web интеграция» tab, and the «Битрикс24» tab is one press away

#### Scenario: A manager
- **WHEN** a manager who may manage a project's website key opens the dialog
- **THEN** it shows the web integration without a tab bar and without «Битрикс24»

#### Scenario: A member who manages neither
- **WHEN** a guest or a client opens the CRM page
- **THEN** there is no «Интеграции +» button

#### Scenario: No project selected
- **WHEN** an admin opens the dialog while no board is selected
- **THEN** the «Web интеграция» tab asks to choose a project, and the «Битрикс24» tab works

#### Scenario: Connecting from the dialog
- **WHEN** an admin fills in the address and the token on the «Битрикс24» tab and presses «Подключить»
- **THEN** the tab shows the status `ACTIVE` and the address the portal must call, with a copy control

#### Scenario: Removing
- **WHEN** an admin presses «Отключить портал»
- **THEN** a confirmation block says that syncing stops and the links are forgotten, and nothing changes until it is confirmed
