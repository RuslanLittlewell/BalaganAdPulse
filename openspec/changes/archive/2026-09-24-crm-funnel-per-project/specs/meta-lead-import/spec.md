## REMOVED Requirements

### Requirement: Imported leads land on the client's board
**Reason**: Funnels are per project, so an imported lead lands on its project's board.
**Migration**: Replaced by "Imported leads land on the project's board".

## ADDED Requirements

### Requirement: Imported leads land on the project's board
Each imported lead SHALL be created on the CRM board of the connected project, in stage `NEW`, before the leads already in that stage. It SHALL never be placed on another project's board. Leads imported by one poll SHALL be committed together with the advance of the covered period, so a poll either records all of its leads or none. Leads claimed within one poll SHALL keep their relative order among themselves, all placed ahead of the leads that were already in `NEW`.

#### Scenario: Board placement
- **WHEN** a lead is imported for project A of a client that also has project B
- **THEN** it appears first in Новый лид on project A's board and on no other board

#### Scenario: A poll importing several leads
- **WHEN** one poll imports two new leads for project A, which already had a lead in Новый лид
- **THEN** both new leads are ahead of the existing one, in the order the poll returned them

## MODIFIED Requirements

### Requirement: Disconnecting stops lead polling without removing leads
Disconnecting a project SHALL stop lead polling and keep every imported lead, its answers and its recorded source. A poll in flight when the connection is disconnected or its credential replaced SHALL NOT create leads or advance the covered period.

#### Scenario: Disconnect during a poll
- **WHEN** a member disconnects while a lead poll is waiting for Meta
- **THEN** its eventual response creates no leads

#### Scenario: Leads after disconnect
- **WHEN** a project is disconnected
- **THEN** its imported leads remain on the project's board with their Meta source
