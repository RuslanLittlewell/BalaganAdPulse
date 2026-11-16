## Purpose

Let members organize their profile settings and choose an interface language and a preference for the planned campaign CRM feature.

## ADDED Requirements

### Requirement: Profile settings have General and Account tabs

The profile dialog SHALL open on General and expose Account through the application's existing tab control. General SHALL contain language and campaign CRM preferences. Account SHALL preserve avatar, contact and password editing and Telegram integration. Switching tabs SHALL preserve unsaved account edits during the current dialog session.

#### Scenario: Switching to Account
- **WHEN** a member opens profile settings and selects Account
- **THEN** the member can edit their existing profile and use the Telegram integration

#### Scenario: Returning to a draft
- **WHEN** a member edits their name, visits General and returns to Account
- **THEN** their unsaved name remains in the form

### Requirement: Members can choose Russian or English

The interface SHALL offer Russian and English, default to Russian and retain the selected language in the current browser. Saving a new language SHALL apply the corresponding interface dictionary, including navigation and profile settings, and set the document language. Unsupported saved values SHALL use Russian.

#### Scenario: Choosing English
- **WHEN** a member saves English as their language
- **THEN** the interface displays English and keeps English after reloading

### Requirement: Members can retain a campaign CRM preference

General SHALL contain an off-by-default switch labelled CRM by campaign. Saving it SHALL retain a boolean preference for that member in the current browser. The interface SHALL explain that the feature will be implemented later. The switch SHALL NOT change current CRM routes, permissions or data.

#### Scenario: Enabling the planned feature
- **WHEN** a member enables the campaign CRM switch and saves General settings
- **THEN** reopening settings shows the switch on without enabling new CRM behavior

#### Scenario: A different member
- **WHEN** another member opens settings in the same browser
- **THEN** the first member's campaign CRM choice is not used for that member
