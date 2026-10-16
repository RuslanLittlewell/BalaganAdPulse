## MODIFIED Requirements

### Requirement: Imported leads land on the client's board
Each imported lead SHALL be created on the CRM board of the client that owns the connected project, in stage `NEW`, before the leads already in that stage, naming that project. It SHALL never be placed on the agency board or another client's board. Leads imported by one poll SHALL be committed together with the advance of the covered period, so a poll either records all of its leads or none. Leads claimed within one poll SHALL keep their relative order among themselves, all placed ahead of the leads that were already in `NEW`.

#### Scenario: Board placement
- **WHEN** a lead is imported for a project of client A
- **THEN** it appears first in Новый лид on client A's board and on no other board

#### Scenario: A poll importing several leads
- **WHEN** one poll imports two new leads for client A, which already had a lead in Новый лид
- **THEN** both new leads are ahead of the existing one, in the order the poll returned them

#### Scenario: Partial failure
- **WHEN** a poll fails after reading some leads
- **THEN** none of them are created and the next poll imports them
