## ADDED Requirements

### Requirement: General settings captions are not interactive

The language, theme, Telegram and campaign CRM captions in General SHALL be plain text. Clicking a caption SHALL NOT focus or activate a control or change a preference. Selects and switches SHALL retain accessible names and direct pointer and keyboard interaction.

#### Scenario: Clicking a caption
- **WHEN** a member clicks a General setting caption
- **THEN** the associated control does not open, toggle or receive focus and the preference remains unchanged

#### Scenario: Using a control
- **WHEN** a member operates a General select or switch directly
- **THEN** it remains accessible by its setting name and works as before
