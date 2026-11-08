# site-traffic-sources Specification

## Purpose
Show a connected site's visits by origin: which channels and which sources and mediums sent them, taken from the site's Google Analytics 4 property and refreshed every day.

## Requirements

### Requirement: A site links one Google Analytics 4 property

A property SHALL be linkable in two ways.

When a site is connected, the Google sign-in that lists the Search Console sites SHALL also list the Google Analytics 4 properties the same sign-in reaches. The member SHALL be able to choose a site and, optionally, one property, and the site and its property SHALL be saved together. Choosing no property SHALL be the default. When Google did not grant Analytics access or the account has no property, no properties SHALL be listed and the site SHALL connect without one. A property the sign-in does not reach SHALL be refused and nothing SHALL be saved.

For a site connected without a property, a member with the integration permission SHALL be able to link one later in three steps:
1. sign in with Google from the site's panel;
2. see the GA4 properties that sign-in reaches;
3. choose one of them.

The later sign-in SHALL be added to the credential of that site alone and SHALL keep its access to Search Console. A site SHALL have at most one linked property. Linking a different one SHALL replace the first and delete its traffic data. Linking the same one again SHALL keep its data. Customers, including a client who may edit the project, SHALL NOT link or unlink a property.

Every sign-in SHALL be completable only by the member who started it, for the project or site it was started for, and once. Unknown or unreachable sites SHALL answer 404. The credential MUST stay encrypted at rest and MUST be left out of read responses, logs, audit events, redirects and browser storage.

#### Scenario: Connect a site with a property
- **WHEN** an authorized member chooses the site site.ru and the property of site.ru in the connection window
- **THEN** the site and the property are saved together, an import is queued, and no response contains a token

#### Scenario: Connect a site without a property
- **WHEN** the member leaves the property as Без Google Analytics
- **THEN** the site is connected and shows the prompt to link a property

#### Scenario: Analytics access not granted
- **WHEN** the member unticks Analytics in Google's consent screen
- **THEN** the connection window lists the sites only, and the site connects without a property

#### Scenario: The sign-in reaches no property
- **WHEN** the signed-in account has no GA4 property
- **THEN** the window lists no properties, and the site connects without one

#### Scenario: A property the sign-in does not reach
- **WHEN** a connection request names a property the sign-in does not reach
- **THEN** it is refused and no site is saved

#### Scenario: Link a property later
- **WHEN** an authorized member signs in from the panel of a site without a property and chooses one
- **THEN** the property is linked, an import is queued, and no response contains a token

#### Scenario: Restricted access
- **WHEN** a client who may edit the project tries to link a property
- **THEN** the server returns 403

#### Scenario: A sign-in started by someone else
- **WHEN** a callback arrives for a sign-in another member started, or one already used
- **THEN** it is refused and nothing is saved

#### Scenario: Unlink
- **WHEN** an authorized member unlinks the property
- **THEN** the site's traffic data is deleted and the Search Console connection and its data stay

#### Scenario: Not configured
- **WHEN** the server has no Google OAuth client or secret
- **THEN** the API reports that Google is not configured, and the site's search figures are unaffected

### Requirement: Sessions are imported every day by channel and by source and medium

For a site with a linked property the server SHALL import, for each day, the sessions split by:
- the channel group Analytics assigns, such as Organic Search, Direct, Referral, Organic Social and Paid Search;
- the source and the medium, up to 200 pairs per day ranked by sessions.

Daily rows SHALL cover the most recent 90 days. The first import SHALL run when the property is linked and SHALL load all 90 days. Afterwards an import SHALL run every morning on the schedule of the search import, and whenever an authorized member refreshes the site. Each import SHALL read the most recent 3 days again, so a day Analytics completes late replaces the earlier figures. A day imported twice SHALL hold one set of figures.

An import that fails part-way SHALL publish nothing, and the previous figures SHALL stay readable. A credential Google rejects SHALL move the site to the sign-in-again state and SHALL NOT delete data. A property that no longer exists or no longer lets the account read it SHALL be reported on the site's panel, with the previous figures kept.

#### Scenario: First import
- **WHEN** a property is linked
- **THEN** 90 days of sessions are imported, and the traffic block shows them when the import finishes

#### Scenario: A late day
- **WHEN** Analytics reports 120 sessions for yesterday and the next morning reports 150
- **THEN** yesterday holds 150

#### Scenario: A failing import
- **WHEN** Google answers with an error half way through an import
- **THEN** no new figures are saved, and the previous ones are still shown

#### Scenario: A revoked sign-in
- **WHEN** Google rejects the stored credential
- **THEN** the site asks to sign in again, and the traffic figures stay

### Requirement: Traffic is read by channel, by source and by day

The API SHALL answer, for a period, with:
- the sessions of each channel group, its share of all sessions, and the sessions of the same channel in the previous period of the same length;
- the top 100 source and medium pairs by sessions, each with its share;
- the total sessions of each day.

Shares SHALL be fractions of the period's total sessions. A period with no sessions SHALL answer with zeros and no shares. Reads SHALL be open to everyone who can read the project, and SHALL NOT include credentials.

#### Scenario: Channels for a period
- **WHEN** the period has 600 organic and 400 direct sessions
- **THEN** the answer lists Organic Search with 600 and share 0.6, then Direct with 400 and share 0.4

#### Scenario: The previous period
- **WHEN** the previous period had 500 organic sessions
- **THEN** the answer carries 500 beside the 600 of the chosen period

#### Scenario: No property linked
- **WHEN** the site has no linked property
- **THEN** the answer says traffic is not connected

### Requirement: The SEO tab shows the traffic sources

The SEO tab SHALL show a Источники трафика block that uses the chosen period of the tab. It SHALL show, in this order:
- the channels, each with its sessions, its share as a bar, and its change against the previous period, best first;
- the sources and mediums, ranked by sessions in a bounded, scrollable list;
- the sessions per day as a chart.

Every figure SHALL be a number the member can read without hovering. While the property's first import is queued or running, the block SHALL show a loader instead of figures. When a property is linked and the period has no sessions, the block SHALL say that Analytics recorded none and that the site's tag may be missing. When no property is linked, the block SHALL offer Подключить Google Analytics to members who may manage integrations, and SHALL say that traffic is not connected to everyone else.

#### Scenario: Channels shown
- **WHEN** the period has 600 organic and 400 direct sessions
- **THEN** the block lists Organic Search with 600 and 60 percent, then Direct with 400 and 40 percent

#### Scenario: Waiting for the first import
- **WHEN** the property was just linked and its import is running
- **THEN** the block shows a loader

#### Scenario: Linking offered
- **WHEN** a member who may manage integrations opens a site without a property
- **THEN** the block offers Подключить Google Analytics

#### Scenario: Linking not offered
- **WHEN** a client's person opens the same site
- **THEN** the block says traffic is not connected and offers no button

#### Scenario: A property without a tag
- **WHEN** a property is linked and the period has no sessions
- **THEN** the block says Analytics recorded no sessions
