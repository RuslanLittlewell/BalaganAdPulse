## Purpose

Lets a member hand someone outside the organization one address that opens a project's metrics, read only, without an account.

## ADDED Requirements

### Requirement: A project has at most one share link

A project SHALL have no share link or exactly one. The link SHALL be the address
`/share/<token>` on the application's own domain, where the token is random, unguessable and
used by no other link. An ADMIN, and nobody else, SHALL create the link,
read it again at any time, replace it with a new one and switch it off. Replacing SHALL give the
link a new token and stop the old address at once. Switching off SHALL stop the address and
leave the project without a link.

#### Scenario: Creating the link
- **WHEN** an admin creates a link for a project without one
- **THEN** the project has one link and its address is shown for copying

#### Scenario: Reading it later
- **WHEN** the admin opens the share dialog of that project again
- **THEN** the same address is shown

#### Scenario: Replacing the link
- **WHEN** the admin replaces the link and someone opens the old address
- **THEN** the old address shows that the link is unavailable and the new address opens the project

#### Scenario: Switching the link off
- **WHEN** the admin switches the link off
- **THEN** its address shows that the link is unavailable and the project offers to create a new one

#### Scenario: A second link is not made
- **WHEN** an admin asks to create a link for a project that already has one
- **THEN** the project still has one link, and it is the one shown

### Requirement: The project header offers sharing

The project header SHALL offer a «Поделиться» button beside «Превью» to an ADMIN only. It SHALL open a dialog that creates the link when the project has none,
and otherwise shows the address with a copy control, a control that replaces the link and a
control that switches it off. Replacing and switching off SHALL each ask for confirmation in the
dialog, saying that the current address will stop working. The button SHALL be absent in preview.

#### Scenario: Copying the address
- **WHEN** an admin presses the copy control in the dialog
- **THEN** the full address of the link is on the clipboard and the dialog confirms it

#### Scenario: Confirming a replacement
- **WHEN** an admin chooses to replace the link
- **THEN** the dialog asks to confirm, and the link changes only after the confirmation

#### Scenario: Roles without sharing
- **WHEN** a MANAGER, GUEST, CLIENT or CLIENT_ADMIN opens a project
- **THEN** the project header has no «Поделиться» button

### Requirement: The link opens the project's metrics without signing in

Opening a live link SHALL show the shared page to anyone, signed in or not, and SHALL NOT ask
for a login. The page SHALL show the project's name as its heading and the same block preview
shows: the metrics heading with the period controls, the summary tiles, a tab for every ad
account and every SEO site of the project, the running-only switch, the campaign KPI blocks and
the campaign table. The table SHALL include the CRM stage columns when the project's
organization has the CRM module. A signed-in visitor SHALL see the shared page the same way,
whatever their own organization and role.

#### Scenario: A visitor without an account
- **WHEN** someone who is not signed in opens a live link
- **THEN** the shared page shows the project's tiles, account tabs and campaign table, and no login form

#### Scenario: Switching accounts
- **WHEN** the project has two ad accounts and the visitor chooses the second tab
- **THEN** the tiles and the table show that account's campaigns

#### Scenario: One account
- **WHEN** the project has a single ad account and no SEO site
- **THEN** the page shows one tab naming that account, as preview does, and opens on its table

#### Scenario: Changing the period
- **WHEN** the visitor chooses another period
- **THEN** the tiles and the table show the figures of that period

#### Scenario: An SEO site
- **WHEN** the visitor chooses the tab of an SEO site
- **THEN** the page shows that site's SEO summary and overview

#### Scenario: CRM columns
- **WHEN** the project's organization has the CRM module
- **THEN** the campaign table shows the lead stage columns, as it does for members

### Requirement: A visitor opens a campaign

On the shared page a visitor SHALL open a campaign from the table or from a campaign KPI block.
The campaign SHALL open at an address under the same link and show its summary, daily chart, ad
sets, ads and creatives for the chosen period, as preview shows them. Going back SHALL return to
the shared project page with the same period and tab.

#### Scenario: Opening a campaign
- **WHEN** the visitor opens a campaign from the table
- **THEN** the address stays under `/share/<token>` and the campaign's ad sets are listed

#### Scenario: Looking at a creative
- **WHEN** the visitor opens an ad's creative
- **THEN** the creative is shown as it is to members

#### Scenario: Coming back
- **WHEN** the visitor goes back from the campaign
- **THEN** the shared project page shows the same period and tab

### Requirement: The shared page changes nothing

The shared page SHALL offer no navigation, no project switcher, no tasks, no integrations, no
tile configuration, no KPI editing, no SEO check and no other control that changes data. Through
a link the API SHALL answer only the reads the shared page and the shared campaign page make;
every other request through the link, of any method, SHALL be answered 404.

#### Scenario: No edit controls
- **WHEN** the shared page shows the summary tiles and the KPI blocks
- **THEN** there is no control to add a tile or change a KPI

#### Scenario: A write through the link
- **WHEN** someone sends a POST, PUT, PATCH or DELETE under a live link
- **THEN** the API responds 404 and nothing changes

#### Scenario: A read the page does not make
- **WHEN** someone requests the organization's members, the project's tasks or the CRM contacts under a live link
- **THEN** the API responds 404

### Requirement: The link reaches only its project

A link SHALL reach only the project it was made for. A request through the link that names
another project, or a campaign, ad set, ad, creative or SEO site of another project, SHALL be
answered 404, also when the other project belongs to the same organization.

#### Scenario: Another project's campaign
- **WHEN** someone requests, under a live link, a campaign that belongs to another project of the same organization
- **THEN** the API responds 404

### Requirement: A dead link says so

A link SHALL be dead when its token is unknown, was replaced or was switched off, when its
project was deleted, or when the project's organization is suspended. Opening a dead link SHALL
show a page saying the link is unavailable, with no figures and no login form, and the API SHALL
answer every request through it 404.

#### Scenario: A replaced token
- **WHEN** someone opens an address whose token was replaced
- **THEN** the page says the link is unavailable

#### Scenario: A suspended organization
- **WHEN** the project's organization is suspended and someone opens its link
- **THEN** the page says the link is unavailable

### Requirement: The link follows the project, not its integrations

The shared page SHALL show the project's current ad accounts and SEO sites each time it is
opened. Connecting, reconnecting or removing an integration SHALL NOT change or stop the link.

#### Scenario: An account connected later
- **WHEN** a member connects a new ad account to a project that already has a link
- **THEN** the shared page shows a tab for that account once its campaigns arrive

#### Scenario: An integration removed
- **WHEN** a member removes one of the project's integrations
- **THEN** the link still opens the project

### Requirement: Shared reads are bounded

The API SHALL limit how many requests one network address may send through share links in a
minute, and SHALL limit separately how many ad previews and creative lists one link may request
in a minute, since each of them may call the advertising platform. A request over either limit
SHALL be answered 429.

#### Scenario: Too many requests
- **WHEN** one address sends more requests through share links in a minute than the limit allows
- **THEN** the API responds 429 until the minute is over

### Requirement: The shared page stays private to its address

The shared page SHALL NOT be shown inside a frame on another site. The shared page and the
API's answers through a link SHALL tell search engines not to index or follow them. Requests the
page makes to other sites SHALL NOT carry the token in their referrer.

#### Scenario: Embedding
- **WHEN** another site puts the link in an iframe
- **THEN** the browser refuses to show the page in the frame

#### Scenario: Indexing
- **WHEN** a crawler fetches the link
- **THEN** the answer carries a noindex, nofollow directive
