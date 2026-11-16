## MODIFIED Requirements

### Requirement: Profile settings have General and Account tabs

The profile dialog SHALL list Account before General using the application's existing tab control and SHALL select Account on every opening. General SHALL contain language and campaign CRM preferences. Account SHALL preserve avatar, contact and password editing and Telegram integration. Switching tabs SHALL preserve unsaved account edits during the current dialog session.

#### Scenario: Opening settings
- **WHEN** a member opens profile settings
- **THEN** Account is the first and selected tab and General is second

#### Scenario: Switching to Account
- **WHEN** a member visits General and selects Account
- **THEN** the member can edit their existing profile and use the Telegram integration

#### Scenario: Returning to a draft
- **WHEN** a member edits their name, visits General and returns to Account
- **THEN** their unsaved name remains in the form
