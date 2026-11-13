## Purpose

Send the conversion events that leads from Meta lead forms reach on the CRM board to the client's
Meta dataset through the Conversions API, so campaigns can optimise on qualified leads and sales,
and show the media buyer what was sent and what failed.

## ADDED Requirements

### Requirement: A project connects one Meta dataset

A member whose role may manage integrations SHALL be able to connect one Meta dataset to a reachable
project with the dataset ID, a Conversions API access token, an optional test event code and the
currency of lead amounts, which SHALL default to the project's currency. The dataset ID and token
MUST be checked against Meta before they are saved or replace the existing ones; when Meta refuses
them, the existing connection SHALL remain unchanged and the member SHALL receive a safe error. The
token MUST be encrypted at rest and excluded from read responses, logs, audit events and browser
persistent storage. A read SHALL return the dataset ID, the dataset's name in Meta, the test event
code, the currency, the connection's state and the time of the last successful send. The member
SHALL be able to replace the token, change the test event code and the currency, and disconnect.
Disconnecting SHALL stop sending, drop the events waiting to be sent, and keep the record of events
already sent. Members who may not manage integrations SHALL receive 403; an unknown or unreachable
project SHALL return 404. Connecting, changing and disconnecting SHALL be recorded in the audit
log without the token.

#### Scenario: Connecting a dataset
- **WHEN** a manager submits a dataset ID and a token that Meta accepts
- **THEN** the dataset is connected and the response shows its ID and name but no token

#### Scenario: A token Meta refuses
- **WHEN** a manager replaces the token with one Meta refuses
- **THEN** the existing connection and token remain and the manager sees a safe error

#### Scenario: Disconnecting
- **WHEN** a manager disconnects a dataset with three events waiting and twenty sent
- **THEN** the three events are dropped, nothing more is sent, and the twenty stay in the record

#### Scenario: A client
- **WHEN** a client who may edit the project requests its dataset
- **THEN** the server responds 403 without configuration details

### Requirement: Events of Meta lead form leads are sent

When a lead imported from a Meta lead form reaches an event of its project at a stage change and
the project has a connected dataset, the server SHALL send that event to the dataset, no later than
five minutes after the change unless the event waits for the amount. A lead that did not come from
a Meta lead form SHALL NOT be sent. Editing an event's stages SHALL NOT send events for stage
changes made before the edit. Each lead SHALL send each event at most once, whatever retries,
server instances, reconnections and moves back and forth occur.

#### Scenario: A qualified lead from a form
- **WHEN** a manager moves a lead imported from a Meta form into a stage of «Квал»
- **THEN** «Квал» for that lead reaches the dataset within five minutes

#### Scenario: A lead entered by hand
- **WHEN** a manager moves a lead created on the board into a stage of «Квал»
- **THEN** nothing is sent to Meta

#### Scenario: Moved twice
- **WHEN** a lead from a form enters «Квал», leaves it and enters it again
- **THEN** «Квал» is sent for it once

#### Scenario: Two instances
- **WHEN** two server instances find the same events due
- **THEN** each event is sent once

### Requirement: What an event carries

Each event sent SHALL carry the event's name; the time of the stage change; the action source
`system_generated`; `event_source` `crm` and `lead_event_source` `AdPulse` in its custom data; an
event ID unique to the lead and the event; and, when the project has a test event code, that code.
It SHALL identify the person by the Meta lead ID, unhashed, and by the following values hashed with
SHA-256 when the lead has them: the phone as digits only, the email trimmed and in lower case, and
the lead's own ID. No other personal data SHALL be sent, and personal data SHALL NOT be written to
logs or to the record of sends unhashed. An event that carries the amount SHALL send the lead's
amount at the time of sending as its value, with the dataset's currency, when the amount is above
zero.

#### Scenario: A sale
- **WHEN** a lead from a form with the phone «+375 (29) 123-45-67», the email « Ivan@Mail.ru » and
  the amount 1200 reaches «Продажа», which carries the amount, in a dataset whose currency is BYN
- **THEN** the event carries the Meta lead ID, the SHA-256 of «375291234567», the SHA-256 of
  «ivan@mail.ru», the hashed lead ID, the value 1200 and the currency BYN

#### Scenario: Test mode
- **WHEN** the dataset has the test event code «TEST123»
- **THEN** every event sent carries «TEST123», and removing the code later does not send those
  events again

### Requirement: An event carrying the amount waits for it

When a lead reaches an event that carries the amount and the lead has no amount above zero, the
event SHALL wait until the amount is entered or until three days have passed since the stage
change, whichever comes first. It SHALL then be sent, without a value if the lead still has no
amount.

#### Scenario: Amount entered later
- **WHEN** a lead reaches «Продажа» at 10:00 and a manager enters the amount 900 at 16:00
- **THEN** «Продажа» is sent after 16:00 with the value 900 and the time 10:00

#### Scenario: No amount at all
- **WHEN** no amount is entered within three days
- **THEN** «Продажа» is sent without a value

### Requirement: Old events and failures

An event whose stage change is more than seven days old SHALL NOT be sent and SHALL be marked as
expired. A send that fails for a temporary reason SHALL be retried with growing pauses until it
succeeds or the event expires. An event that Meta refuses SHALL be marked as not sent with Meta's
reason, and the other events sent with it SHALL still be sent. When Meta rejects the token, the
connection SHALL be marked as needing a new token and events SHALL wait; replacing the token SHALL
resume sending.

#### Scenario: An outage of two days
- **WHEN** Meta is unreachable for two days and then answers
- **THEN** the events of those two days are sent with their original times

#### Scenario: A revoked token
- **WHEN** the client revokes the token in Events Manager
- **THEN** the panel shows that a new token is needed, events wait, and after the token is replaced
  the waiting events younger than seven days are sent

#### Scenario: Too old
- **WHEN** an event has waited for a valid token for eight days
- **THEN** it is marked as expired and is not sent

#### Scenario: One refused event
- **WHEN** Meta refuses one event of a batch of fifty
- **THEN** the other forty-nine are sent and the refused one shows Meta's reason

### Requirement: Connecting catches up on the last seven days

Connecting a dataset, including connecting again after a disconnect, SHALL send the events that
leads from Meta lead forms reached during the previous seven days, except those already sent to
that project.

#### Scenario: Connecting on a running board
- **WHEN** a manager connects a dataset to a project where five form leads reached «Квал» in the
  last week and two reached it ten days ago
- **THEN** the five are sent with their original times and the two are not

### Requirement: The Conversions API panel

A project's «Интеграции» block SHALL show a Conversions API panel, titled by the Meta logo and
«Conversions API», to a member who may manage integrations when the project has a Meta connection
and the organization uses the CRM module.
The panel SHALL let the member connect, change and disconnect the dataset and manage the project's
conversion events, choosing their stages from the board's columns. It SHALL show the connection's
state, the number of events sent today, over the last 7 days and over the last 30 days, and the 20
latest events with the lead's name, the event, the time of the stage change and its state:
«Отправлено», «В очереди», «Ждёт сумму», «Не отправлено» with the reason, or «Устарело». While the
dataset has a test event code, the panel SHALL say that events go only to Meta's test events. Days
SHALL be counted in the time zone of the project's Meta account.

#### Scenario: A manager opens a connected project
- **WHEN** a manager opens a project with a Meta connection and a dataset
- **THEN** the Conversions API panel shows the dataset, the events with their stages, the counts
  for today, 7 and 30 days and the latest events

#### Scenario: A project without Meta
- **WHEN** a manager opens a project connected only to Google
- **THEN** no Conversions API panel is shown

#### Scenario: A guest
- **WHEN** a guest opens a project with a Meta connection
- **THEN** no Conversions API panel is shown

#### Scenario: A failed event
- **WHEN** Meta refused an event because of an invalid parameter
- **THEN** the panel lists it as «Не отправлено» with Meta's reason
