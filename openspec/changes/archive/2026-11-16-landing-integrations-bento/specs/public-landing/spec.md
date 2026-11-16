## ADDED Requirements

### Requirement: The connections section shows what BalaganBI connects to

The connections section SHALL open with a bento of three diagrams above the connection guides:
the client's accounts flowing through BalaganBI into reports, a hub of every integration, and the
last 30 days of figures. The hub SHALL name the integrations BalaganBI has, Meta Ads, Google Ads,
Google Search Console and Telegram, and SHALL mark the planned ones, Яндекс Директ and TikTok Ads,
as coming soon. Every name and status SHALL be in the served document as text. While the bento is
on screen, the diagrams SHALL move: data travels along the connectors, the report count grows, the
hub syncs the connected integrations one at a time, and the chart shows the day under the
pointer. For a visitor who prefers reduced motion they SHALL stand still.

#### Scenario: Reading the hub
- **WHEN** the home page is read without running scripts
- **THEN** the connections section names Meta Ads, Google Ads, Google Search Console and Telegram
  as connected, and Яндекс Директ and TikTok Ads as coming soon

#### Scenario: The hub syncs
- **WHEN** the bento comes into view
- **THEN** the hub highlights the connected integrations one after another, never a planned one

#### Scenario: Pointing at the chart
- **WHEN** a visitor moves the pointer across the chart
- **THEN** the chart marks the nearest day and shows that day's leads

#### Scenario: Reduced motion
- **WHEN** a visitor who prefers reduced motion scrolls to the connections section
- **THEN** no connector carries moving data and the report count stays as it is
