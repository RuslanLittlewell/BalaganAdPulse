## ADDED Requirements

### Requirement: Website leads show their source

The card of a lead created from a website SHALL show a source block with the UTM source, medium, campaign, content and term, the page address, the referrer, the time of submission and the form's other answers. Values that were not sent SHALL be omitted. The block SHALL NOT appear for leads of other origins.

#### Scenario: A website lead with tags
- **WHEN** a member opens a website lead sent with utm_source and utm_campaign
- **THEN** the source block lists both values and the page address

#### Scenario: A hand-made lead
- **WHEN** a member opens a lead created by hand
- **THEN** the card has no website source block
