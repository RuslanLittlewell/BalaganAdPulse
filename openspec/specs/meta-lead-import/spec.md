# meta-lead-import Specification

## Purpose

Bring prospects who submit a Meta Instant Form on a connected project's ads into that project's client CRM board within minutes, once each, with contact details and the advertising that produced them.

## Requirements

### Requirement: Connected projects are polled for leads
The server SHALL poll Meta for Instant Form leads of every connected project no less often than every fifteen minutes, using the project's saved credential and requiring no input beyond the existing connection. Only leads Meta attributes to an ad of the connected account SHALL be imported. Lead polling SHALL run independently of the daily advertising import: neither SHALL wait for, block or fail the other. At most one lead poll per project SHALL be active across all server instances. Polling SHALL survive process restarts and resume overdue work. A connection waiting for credential replacement SHALL NOT be polled.

A manual refresh of the connection SHALL also request an immediate lead poll.

#### Scenario: A prospect submits a form
- **WHEN** a prospect submits an Instant Form on an ad of a connected project
- **THEN** the lead appears on the project client's CRM board within fifteen minutes of Meta making it available

#### Scenario: Competing workers
- **WHEN** two server instances find the same project due for a lead poll
- **THEN** only one polls it and only its current ownership may create leads

#### Scenario: Advertising import in progress
- **WHEN** a long advertising import is running for a project
- **THEN** lead polls for that project continue on schedule

#### Scenario: Credential replacement required
- **WHEN** a connection is waiting for a new token
- **THEN** no lead poll runs until the token is replaced or a manual retry is requested

### Requirement: Leads from the previous seven days are imported first
The first lead poll of a connection SHALL wait for its first successful advertising import. The first successful lead poll SHALL import leads created during the seven days before that poll; this SHALL apply equally to connections created before this capability was released. Every later poll SHALL import leads created since the end of the last successful poll, so that no lead created between polls is skipped, however long polling was interrupted, within what Meta still returns. A failed or abandoned poll SHALL NOT advance that point. Leads created before the first seven-day window SHALL NOT be imported.

A lead submitted to an ad that stopped delivering before the next frequent poll SHALL still be imported, no later than the first successful daily synchronization after the day of submission.

Replacing the credential for the same account SHALL keep the covered period. Connecting a different account, or connecting again after a disconnect, SHALL start a new seven-day window.

#### Scenario: First poll of an existing connection
- **WHEN** a project connected before this release is polled for the first time
- **THEN** its leads from the last seven days are imported and a lead eight days old is not

#### Scenario: Outage
- **WHEN** polls fail for several hours and then succeed
- **THEN** every lead created during the outage is imported by the successful poll

#### Scenario: Ad paused between polls
- **WHEN** a prospect submits a form moments before its ad is paused
- **THEN** the lead is imported no later than the next morning's successful synchronization

#### Scenario: New connection
- **WHEN** a project is connected and its first advertising import is still running
- **THEN** no lead poll runs until that import succeeds, after which the last seven days of leads are imported

### Requirement: Each Meta lead is imported once
A Meta lead SHALL create at most one CRM lead, identified by its Meta lead identifier, regardless of overlapping polls, retries, concurrent instances or credential replacement. Once imported, a Meta lead SHALL never be imported again: editing, moving or deleting the CRM lead SHALL NOT cause it to reappear.

#### Scenario: Repeated poll
- **WHEN** a poll returns a lead that was already imported
- **THEN** no second lead is created and the existing lead is unchanged

#### Scenario: Deleted imported lead
- **WHEN** a member deletes an imported lead and Meta still returns it on a later poll
- **THEN** the lead is not recreated

### Requirement: Imported leads land on the client's board
Each imported lead SHALL be created on the CRM board of the client that owns the connected project, in stage `NEW`, after the leads already in that stage, naming that project. It SHALL never be placed on the agency board or another client's board. Leads imported by one poll SHALL be committed together with the advance of the covered period, so a poll either records all of its leads or none.

#### Scenario: Board placement
- **WHEN** a lead is imported for a project of client A
- **THEN** it appears last in Новый лид on client A's board and on no other board

#### Scenario: Partial failure
- **WHEN** a poll fails after reading some leads
- **THEN** none of them are created and the next poll imports them

### Requirement: Form answers fill the lead's contact details
An imported lead's name SHALL be the prospect's full name answer, otherwise their first and last name answers joined, otherwise their phone, otherwise their email, otherwise the Meta lead identifier. Phone, email and company SHALL come from the corresponding standard form answers. An answer that is invalid or longer than the matching lead field allows SHALL be left out of that field rather than rejected or altered; the lead SHALL still be imported. Website, source text and notes SHALL start empty.

Every answer, including mapped ones, SHALL be kept on the lead in form order as question and values. At most 100 answers and 10000 characters of answer text SHALL be kept per lead; answers beyond those bounds SHALL be dropped and the lead SHALL indicate that answers were omitted. Contact values and answers SHALL NOT appear in logs, error details or realtime notifications.

#### Scenario: Standard contact form
- **WHEN** a form returns full name, phone number and email answers
- **THEN** the lead's name, phone and email hold those values and the answers list shows all three

#### Scenario: Name split in two questions
- **WHEN** a form returns only first name and last name answers
- **THEN** the lead's name is the first and last name joined by a space

#### Scenario: Invalid email answer
- **WHEN** a form returns an email answer that is not a valid address
- **THEN** the lead is imported without an email and the answer remains readable in the answers list

#### Scenario: Custom question
- **WHEN** a form asks a custom question
- **THEN** its question and answer are readable on the lead and no contact field is filled from it

### Requirement: Imported leads are attributed to the advertising that produced them
An imported lead SHALL record the connected account identifier, the form identifier, and the Meta identifiers and names of the campaign, ad set and ad as Meta reported them at import time, together with the moment the prospect submitted the form. These recorded values SHALL remain when the local campaign, ad set or ad is later removed or renamed.

The lead SHALL be linked to the project's campaign and ad whose Meta identifiers match. When they have not been imported yet, the lead SHALL be linked automatically after a later advertising import brings them in, without member action.

#### Scenario: Ad already imported
- **WHEN** a lead is imported for an ad that exists in the project's campaign hierarchy
- **THEN** the lead names that campaign and that ad

#### Scenario: Ad launched after the last advertising import
- **WHEN** a lead arrives for an ad not yet imported into the project
- **THEN** the lead shows the Meta campaign, ad set and ad names at once and is linked to the local campaign and ad after the next advertising import

#### Scenario: Campaign removed locally
- **WHEN** the campaign linked to an imported lead is removed
- **THEN** the lead stays, its campaign link is released and the recorded Meta names still show where it came from

### Requirement: Lead import status is visible and separate
The connection read SHALL expose the lead import state, the time of the last successful lead poll and a safe failure reason. The project's Meta integration panel SHALL show the time of the last successful lead poll in Russian, and SHALL explain lead import in Russian only while it needs access or its last poll failed; it SHALL NOT show the lead import state otherwise. A refusal caused by missing lead permissions or Leads Access Manager restrictions SHALL mark only lead import as needing access, explain which access is required, and SHALL NOT change the advertising import status or request a new token. Such a connection SHALL be retried at least hourly and SHALL recover without member action once access is granted. A credential Meta rejects as invalid or expired SHALL follow the existing credential replacement flow. Transient failures SHALL be retried at the next poll.

#### Scenario: Token lacks lead permission
- **WHEN** the saved token can read advertising but not leads
- **THEN** advertising imports keep succeeding, the panel reports that lead access is missing, and no token replacement is requested

#### Scenario: Access granted later
- **WHEN** lead access is granted to a connection previously refused
- **THEN** a poll within the next hour succeeds and imports leads from the covered period

#### Scenario: Restricted reader
- **WHEN** a member without project update permission reads the project
- **THEN** no lead import status or failure reason is exposed to them

#### Scenario: Healthy lead import
- **WHEN** lead polls succeed
- **THEN** the panel shows only the time of the last successful lead poll, which moves forward with each poll, and no lead import state

#### Scenario: Before the first lead poll
- **WHEN** a connection has not completed a lead poll yet and nothing has failed
- **THEN** the panel shows nothing about lead import

### Requirement: Disconnecting stops lead polling without removing leads
Disconnecting a project SHALL stop lead polling and keep every imported lead, its answers and its recorded source. A poll in flight when the connection is disconnected or its credential replaced SHALL NOT create leads or advance the covered period.

#### Scenario: Disconnect during a poll
- **WHEN** a member disconnects while a lead poll is waiting for Meta
- **THEN** its eventual response creates no leads

#### Scenario: Leads after disconnect
- **WHEN** a project is disconnected
- **THEN** its imported leads remain on the client's board with their Meta source
