## ADDED Requirements

### Requirement: Imported leads show where they came from
A lead imported from a Meta integration SHALL show, in its detail dialog, a read-only source section containing: the channel Meta and the ad account identifier; the form identifier; the campaign, ad set and ad names recorded at import; the moment the prospect submitted the form; and every kept form answer in form order, with a notice when answers were omitted. When the lead is linked to an ad the member can reach, the section SHALL offer that ad's creative preview. A lead created by a member SHALL show no source section.

On the card, an imported lead with no source text SHALL show `Meta · <campaign name>` as its acquisition source.

The source section SHALL be visible to every member who can read the board and SHALL NOT be writable through the interface or the lead API; contacts, notes and stage of an imported lead SHALL remain editable under the existing permissions.

#### Scenario: Opening an imported lead
- **WHEN** a member opens a lead imported from Meta
- **THEN** the dialog shows the account, form, campaign, ad set, ad, submission time and answers without editing controls for them

#### Scenario: Viewing the creative
- **WHEN** a member opens the creative preview from an imported lead linked to an ad
- **THEN** the ad's creatives are shown as they are from the campaign drill-down

#### Scenario: Card source
- **WHEN** an imported lead from campaign "Весна" has no source text
- **THEN** its card reads `Meta · Весна` where the source is shown

#### Scenario: Manual lead
- **WHEN** a member opens a lead they created by hand
- **THEN** no source section is shown

#### Scenario: Editing an imported lead's contacts
- **WHEN** an authorized member corrects the phone of an imported lead
- **THEN** the phone changes and the recorded source and answers are unchanged

## MODIFIED Requirements

### Requirement: Lead identity contacts and acquisition source
A lead SHALL have a required nonblank name and optional company, phone, email, website, source and plain-text notes. Name and company SHALL be limited to 200 characters, phone to 50, email to 254, website to 2048, source to 200 and notes to 10000. Supplied email SHALL be syntactically valid and website SHALL use HTTP or HTTPS. Empty optional strings SHALL normalize to absence. Source SHALL be manually entered text. A lead SHALL be either created by a member or imported from a Meta integration; creating a lead by hand SHALL NOT require any integration. Absent source text SHALL display the imported origin for an imported lead and Не указан otherwise. Duplicate contacts SHALL be allowed, including between imported and hand-made leads.

#### Scenario: Minimal lead
- **WHEN** a member creates a lead with only a name
- **THEN** it is saved with no invented contact or source values

#### Scenario: Contact round trip
- **WHEN** a member saves a lead's contact details, company, source and notes and reopens it
- **THEN** all supplied values are shown and remain editable by authorized members

#### Scenario: Invalid input
- **WHEN** a name is blank, a field exceeds its limit, or a supplied email or website is invalid
- **THEN** the API returns 400 and the form retains entered values with validation feedback

#### Scenario: Source of a hand-made lead left blank
- **WHEN** a member creates a lead without source text
- **THEN** its card shows Не указан as the source

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

An imported lead SHALL additionally name the ad that produced it, and its project, campaign
and ad SHALL be set by the import alone. A request that changes the project or campaign
of an imported lead SHALL be refused; a request repeating the current values SHALL be
accepted. The lead form SHALL show those choices as read-only for an imported lead.
Deleting the ad SHALL release the ad link and leave the lead standing.

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

#### Scenario: Re-attributing an imported lead
- **WHEN** a request changes the campaign of an imported lead
- **THEN** the API responds 400 and the lead is unchanged

#### Scenario: Saving an imported lead unchanged
- **WHEN** a member saves an imported lead's form after editing only its notes
- **THEN** the notes are saved and its project, campaign and ad are unchanged

### Requirement: Lead changes are audited and synchronized
Each successful lead mutation by a member SHALL record its actor, board, lead and changed fields in an audit event committed with the mutation. Failed writes SHALL record no event. Leads created by a Meta import SHALL NOT be attributed to any member; the lead's recorded source and submission time SHALL identify how it arrived, and later member mutations of it SHALL be audited like any other. Open authorized CRM boards SHALL receive committed changes, including imported leads, through realtime notifications and refresh their selected board; notifications SHALL carry no lead contact data. Authorization SHALL be checked at delivery time. Reconnection SHALL refresh the selected board. Loss of access SHALL clear inaccessible cached data and stop delivery.

#### Scenario: Another member updates a lead
- **WHEN** an authorized member changes a lead on the open board
- **THEN** the other member's board updates without a manual reload

#### Scenario: Unreachable changes
- **WHEN** a lead changes on a board a connected member cannot access
- **THEN** that connection receives no notification about it

#### Scenario: Audit isolation
- **WHEN** a customer requests audit history
- **THEN** CRM events about the agency or other clients are excluded, including their contact fields

#### Scenario: Imported lead arrives on an open board
- **WHEN** a lead poll commits a new lead to a board a member has open
- **THEN** the card appears without a manual reload and no audit event names a member as its creator
