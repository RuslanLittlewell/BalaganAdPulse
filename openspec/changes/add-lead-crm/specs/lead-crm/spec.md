## Purpose

Track prospects, their contact details and acquisition sources through separate sales funnels for the agency and each client, with a familiar Kanban interface.

## ADDED Requirements

### Requirement: Separate agency and client funnels
The CRM SHALL provide one agency board per organization and one board per client, including clients with no projects. A lead SHALL belong to exactly one board. Changing lead details or stage SHALL NOT change its board. Moving leads between boards SHALL NOT be supported in this release.

#### Scenario: Empty client board
- **WHEN** an authorized member opens a client board with no leads or projects
- **THEN** all eight empty stages are displayed and permitted creation controls are available

#### Scenario: Board isolation
- **WHEN** a member selects a client board
- **THEN** only leads belonging to that client board appear, never agency leads or another client's leads

### Requirement: Eight fixed sales stages
The board SHALL display the following fixed stages in order: `NEW` (Новый лид), `CONTACTED` (Связались), `QUALIFIED` (Квалифицирован), `PROPOSAL` (Предложение), `NEGOTIATION` (Переговоры), `WON` (Выигран), `LOST` (Проигран), `DEFERRED` (Отложен). New leads SHALL default to `NEW`. Members SHALL be able to move leads directly between any stages, including reopening terminal outcomes. Stage names SHALL NOT be customizable.

The stages SHALL mean respectively: contact received; attempted or completed first contact; confirmed need, budget and relevance; offer, estimate or demo sent; terms under discussion; sale won; refusal or unsuitable prospect; potential future interest. Qualification SHALL be a manual decision without mandatory budget fields or automatic checks.

#### Scenario: New lead
- **WHEN** a member creates a lead without specifying a stage
- **THEN** it appears last in Новый лид

#### Scenario: Unknown stage
- **WHEN** a request names an unsupported stage
- **THEN** the API responds 400 without storing changes

#### Scenario: Winning and reopening
- **WHEN** a lead is moved into Выигран and then back into Переговоры
- **THEN** only its stage, ordering, update metadata and history change
- **AND** no client, account, project or invitation is created at either transition

### Requirement: Lead identity contacts and acquisition source
A lead SHALL have a required nonblank name and optional company, phone, email, website, source and plain-text notes. Name and company SHALL be limited to 200 characters, phone to 50, email to 254, website to 2048, source to 200 and notes to 10000. Supplied email SHALL be syntactically valid and website SHALL use HTTP or HTTPS. Empty optional strings SHALL normalize to absence. Source SHALL be manually entered text; absent source SHALL display Не указан. No external acquisition integration SHALL be required. Duplicate contacts SHALL be allowed.

#### Scenario: Minimal lead
- **WHEN** a member creates a lead with only a name
- **THEN** it is saved with no invented contact or source values

#### Scenario: Contact round trip
- **WHEN** a member saves a lead's contact details, company, source and notes and reopens it
- **THEN** all supplied values are shown and remain editable by authorized members

#### Scenario: Invalid input
- **WHEN** a name is blank, a field exceeds its limit, or a supplied email or website is invalid
- **THEN** the API returns 400 and the form retains entered values with validation feedback

### Requirement: A lead may name the project and campaign it came from
A lead SHALL optionally name one project and one campaign, so that where a prospect came
from is recorded beside their contact details. Both SHALL be optional: a lead that names
neither is a prospect nobody has attributed yet, and that SHALL remain the default.

The offered projects SHALL follow the board. On a client's board only that client's
projects SHALL be offered and accepted; on the agency board every project of the
organization SHALL be. A project the actor cannot reach SHALL be refused as though it did
not exist.

A named campaign SHALL belong to the named project. Naming a campaign without a project,
or a campaign of another project, SHALL be refused. Changing a lead's project SHALL
release a campaign that no longer belongs to it rather than leaving a stale link. Deleting
a project or campaign SHALL leave its leads standing, with the released field empty.

#### Scenario: An unattributed lead
- **WHEN** a member creates a lead naming neither project nor campaign
- **THEN** it is stored with both absent and appears on the board like any other

#### Scenario: The campaign follows the project
- **WHEN** a member chooses a project in the lead form
- **THEN** the campaign choices are that project's campaigns, and no other project's

#### Scenario: A campaign of another project
- **WHEN** a request names a campaign that does not belong to the named project
- **THEN** the API responds 400 and the lead is unchanged

#### Scenario: A project from another board
- **WHEN** a member on client A's board names a project of client B
- **THEN** the API responds 404 and the lead is unchanged

#### Scenario: Changing the project
- **WHEN** a lead's project changes and its campaign belongs to the previous project
- **THEN** the campaign is released and the lead keeps the new project

#### Scenario: The project is deleted
- **WHEN** a project named by a lead is deleted
- **THEN** the lead remains on its board with no project and no campaign

### Requirement: CRM uses the task board visual language
The CRM SHALL appear in navigation at `/crm`. It SHALL use the task board's column panels, card styling, spacing, scroll behavior, drag overlay and keyboard drag affordance. Each card SHALL show name, supplied company and contact details, and acquisition source. Long values SHALL truncate on the card and be readable in its detail dialog. Empty contacts SHALL NOT produce blank rows. Notes SHALL be editable in the dialog. Contact actions SHALL NOT initiate a drag or accidentally open the editor.

#### Scenario: Opening a card
- **WHEN** a member clicks or keyboard-opens a lead card
- **THEN** a dialog shows the lead's full fields and stage, with editing controls only when permitted

#### Scenario: Narrow display
- **WHEN** the viewport cannot fit eight columns
- **THEN** columns scroll horizontally and each column's cards scroll vertically within the available board height

### Requirement: Agency board selector and customer default
Agency members SHALL see an upper-left selector containing their available boards, with Агентство first when permitted and client boards named by client organization or contact name. Agency roles SHALL default to the agency board. Customers SHALL open their own board automatically and SHALL NOT see a board selector. Selection SHALL survive reload through the page URL and SHALL clear previous-board cards, dialogs and drag state immediately. Unknown or inaccessible selections SHALL show an unavailable state without silently creating or editing leads in a different board.

#### Scenario: Switching boards during a request
- **WHEN** agency staff switches from client A to client B before A's request completes
- **THEN** the selector and cards describe B and A's late response does not populate B

#### Scenario: Customer board
- **WHEN** a customer opens CRM
- **THEN** their own board opens with no agency or other-client selection controls

### Requirement: Stable atomic ordering and deletion
Leads SHALL have stable ordering per board and stage. Creation SHALL append, editing SHALL preserve order, and moving SHALL atomically update stage and position together with affected neighbors. Out-of-range positive positions SHALL append; negative or noninteger positions SHALL return 400. Concurrent moves SHALL preserve unique contiguous ordering. The UI SHALL show moves optimistically and restore authoritative state with feedback after failure. Deletion SHALL require confirmation and close the ordering gap.

#### Scenario: Move persists
- **WHEN** a lead is moved between two cards in another stage and the page reloads
- **THEN** the lead remains between those cards in that stage

#### Scenario: Refused move
- **WHEN** a drag request fails
- **THEN** persisted data stays unchanged and the board restores server state and shows an error

#### Scenario: Concurrent moves
- **WHEN** two members move cards into the same position concurrently
- **THEN** both completed changes result in one consistent order without duplicate positions

#### Scenario: Confirm deletion
- **WHEN** a member cancels deletion
- **THEN** the lead remains unchanged

### Requirement: Lead changes are audited and synchronized
Each successful lead mutation SHALL record its actor, board, lead and changed fields in an audit event committed with the mutation. Failed writes SHALL record no event. Open authorized CRM boards SHALL receive committed changes through realtime notifications and refresh their selected board; notifications SHALL carry no lead contact data. Authorization SHALL be checked at delivery time. Reconnection SHALL refresh the selected board. Loss of access SHALL clear inaccessible cached data and stop delivery.

#### Scenario: Another member updates a lead
- **WHEN** an authorized member changes a lead on the open board
- **THEN** the other member's board updates without a manual reload

#### Scenario: Unreachable changes
- **WHEN** a lead changes on a board a connected member cannot access
- **THEN** that connection receives no notification about it

#### Scenario: Audit isolation
- **WHEN** a customer requests audit history
- **THEN** CRM events about the agency or other clients are excluded, including their contact fields

### Requirement: Client removal removes its funnel only
Deleting a client SHALL remove its CRM leads along with existing dependent data, require a confirmation that mentions CRM leads, and preserve audit history under its existing authorization rules. Agency and other client boards SHALL remain unchanged.

#### Scenario: Client deleted
- **WHEN** an admin confirms deletion of a client with leads
- **THEN** that client's board becomes unavailable and its leads are removed without affecting other boards
