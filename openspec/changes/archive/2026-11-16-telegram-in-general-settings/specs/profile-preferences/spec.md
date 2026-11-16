## MODIFIED Requirements

### Requirement: Profile settings have General and Account tabs

The profile dialog SHALL list Account before General using the application's existing tab control and SHALL select Account on every opening. General SHALL contain language and campaign CRM preferences and Telegram integration. Account SHALL preserve avatar, contact and password editing. Switching tabs SHALL preserve unsaved account edits and an in-progress Telegram connection during the current dialog session.

#### Scenario: Opening settings
- **WHEN** a member opens profile settings
- **THEN** Account is the first and selected tab and General is second

#### Scenario: Switching to Account
- **WHEN** a member visits General and selects Account
- **THEN** the member can edit their existing profile and the Telegram integration is not shown on Account

#### Scenario: Connecting Telegram from General
- **WHEN** a member selects General and Telegram is available to them
- **THEN** they can connect or disconnect the bot and manage its notifications there

#### Scenario: Returning to a draft
- **WHEN** a member edits their name, visits General and returns to Account
- **THEN** their unsaved name remains in the form

#### Scenario: Returning to a pending connection
- **WHEN** a member requests a Telegram connection link, visits Account and returns to General
- **THEN** the pending Telegram link remains available
