## MODIFIED Requirements

### Requirement: Agency board selector and customer default
Agency members SHALL see an upper-left selector containing their available boards, with Агентство first when permitted and client boards named by the client name, even when the client has an organization. When CRM is opened without a board in the address, agency roles SHALL open the board the signed-in person last selected in this browser if they can still reach it, and SHALL otherwise default to the agency board. A board named in the address SHALL take precedence and become the remembered board. The remembered board SHALL belong to the signed-in person, SHALL survive reload, and SHALL NOT be opened for another person signing in on the same browser; a remembered board the person can no longer reach SHALL be forgotten without an error. Customers SHALL open their own board automatically and SHALL NOT see a board selector. Selection SHALL survive reload through the page URL and SHALL clear previous-board cards, dialogs and drag state immediately. Unknown or inaccessible selections named in the address SHALL show an unavailable state without silently creating or editing leads in a different board.

#### Scenario: Client board names
- **WHEN** an agency member opens the selector and client Ромашка has the organization ООО «Цветы»
- **THEN** that client's board is listed as Ромашка

#### Scenario: Switching boards during a request
- **WHEN** agency staff switches from client A to client B before A's request completes
- **THEN** the selector and cards describe B and A's late response does not populate B

#### Scenario: Customer board
- **WHEN** a customer opens CRM
- **THEN** their own board opens with no agency or other-client selection controls

#### Scenario: Returning to CRM from another module
- **WHEN** an agency member selects client A's board, opens another module and returns to CRM through the menu
- **THEN** client A's board opens and the address names it

#### Scenario: A remembered board is no longer reachable
- **WHEN** the board a member last selected is no longer among their boards
- **THEN** CRM opens the default board without an error and no longer remembers the lost one

#### Scenario: Another person on the same browser
- **WHEN** a different person signs in on the browser where client A's board was remembered
- **THEN** CRM opens that person's default board

#### Scenario: The address names a board
- **WHEN** a member opens a CRM address naming client B while client A is remembered
- **THEN** client B's board opens and becomes the remembered board
