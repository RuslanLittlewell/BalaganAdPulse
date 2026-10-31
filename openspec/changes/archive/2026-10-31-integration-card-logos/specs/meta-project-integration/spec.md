## ADDED Requirements

### Requirement: Connection panels are titled by logo and product
Each connection's panel SHALL be titled by its provider's logo followed by the advertising
product's name: the Meta logo and Facebook Ads for a Meta connection, the Google Ads logo and
Google Ads for a Google connection. The logo SHALL be hidden from assistive technology, so the
panel and its heading are named by the product alone.

#### Scenario: A Meta connection
- **WHEN** a member who manages integrations opens a project with a Meta connection
- **THEN** its panel is titled by the Meta logo and Facebook Ads, and is named Facebook Ads

#### Scenario: A Google connection
- **WHEN** the project also has a Google connection
- **THEN** that panel is titled by the Google Ads logo and Google Ads
