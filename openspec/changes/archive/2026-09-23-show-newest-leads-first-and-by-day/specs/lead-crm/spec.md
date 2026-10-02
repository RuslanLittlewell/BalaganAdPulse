## MODIFIED Requirements

### Requirement: Stable atomic ordering and deletion
Leads SHALL have stable ordering per board and per fixed stage or custom column, and custom columns SHALL have stable contiguous ordering per board. Creation SHALL prepend, placing the new lead first in its stage or column and shifting the leads already there down by one; editing SHALL preserve order; moving SHALL atomically update stage and position together with affected neighbors. Out-of-range positive positions given to an explicit move SHALL append; negative or noninteger positions SHALL return 400. Concurrent moves SHALL preserve unique contiguous ordering. The UI SHALL show moves optimistically and restore authoritative state with feedback after failure. Deleting a lead SHALL require confirmation and close the ordering gap.

Every lead stored before this ordering rule took effect SHALL be renumbered once, per board and per fixed stage or custom column, newest `createdAt` first, so existing boards read newest-first immediately rather than only for leads created afterwards. This renumbering SHALL NOT change any lead's stage, column or other field, and SHALL NOT produce an audit event.

#### Scenario: A new lead is placed first
- **WHEN** a member creates a lead in a stage or column that already holds leads
- **THEN** the new lead is first and the existing leads keep their relative order, each one position further back

#### Scenario: Move persists
- **WHEN** a lead is moved between two cards in another column and the page reloads
- **THEN** the lead remains between those cards in that column

#### Scenario: Refused move
- **WHEN** a drag request fails
- **THEN** persisted data stays unchanged and the board restores server state and shows an error

#### Scenario: Concurrent moves
- **WHEN** two members move cards into the same position concurrently
- **THEN** both completed changes result in one consistent order without duplicate positions

#### Scenario: Confirm deletion
- **WHEN** a member cancels deletion
- **THEN** the lead remains unchanged

#### Scenario: Existing boards are reordered once
- **WHEN** a board held leads created under the previous append ordering before this change
  shipped
- **THEN** after the migration, that stage or column lists them newest-`createdAt`-first, with
  no other field of any lead changed
