## MODIFIED Requirements

### Requirement: The calendar follows the selected board

The calendar SHALL show exactly the leads of the board selected in the CRM header, by the
same reach rules as the board, and SHALL reflect a change made elsewhere — by another member,
or by the member themselves on the board — without a manual reload. Switching to another
board while the calendar is shown SHALL replace its leads with that board's own and clear the
previous board's cards immediately.

#### Scenario: Reach is the same
- **WHEN** a member reaches only project A's board and project B's board
- **THEN** the calendar, like the board selector, offers only those two boards' leads

#### Scenario: A change made by someone else
- **WHEN** another member imports a lead onto the board the calendar is showing
- **THEN** the new lead appears in its arrival day's column without the member reloading

#### Scenario: Switching boards during the calendar view
- **WHEN** a member switches from project A's board to project B's while the calendar is open
- **THEN** the calendar shows project B's leads and none of project A's remain
