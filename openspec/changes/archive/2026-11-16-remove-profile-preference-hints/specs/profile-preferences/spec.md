## MODIFIED Requirements

### Requirement: Members can retain a campaign CRM preference

General SHALL contain an off-by-default switch labelled CRM by campaign. Saving it SHALL retain a boolean preference for that member in the current browser. The switch SHALL NOT change current CRM routes, permissions or data. General SHALL NOT display the language reload or planned feature explanatory block.

#### Scenario: Enabling the planned feature
- **WHEN** a member enables the campaign CRM switch and saves General settings
- **THEN** reopening settings shows the switch on without enabling new CRM behavior

#### Scenario: A different member
- **WHEN** another member opens settings in the same browser
- **THEN** the first member's campaign CRM choice is not used for that member

#### Scenario: Viewing General
- **WHEN** a member opens General
- **THEN** its preference controls appear without the language reload and planned feature explanations
