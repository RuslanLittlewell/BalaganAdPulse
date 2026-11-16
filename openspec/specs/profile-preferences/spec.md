# profile-preferences Specification

## Purpose
Let members organize their profile settings and choose an interface language and a preference for the planned campaign CRM feature.

## Requirements

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

### Requirement: Members can choose Russian or English

The interface SHALL offer Russian and English, default to Russian and retain the selected language in the current browser. Saving a new language SHALL apply the corresponding interface dictionary, including navigation and profile settings, and set the document language. Unsupported saved values SHALL use Russian.

#### Scenario: Choosing English
- **WHEN** a member saves English as their language
- **THEN** the interface displays English and keeps English after reloading

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

### Requirement: Successful saves close profile settings

Saving General or Account settings successfully SHALL close the profile dialog. Success notifications SHALL remain visible outside the closed dialog. Saving a changed language SHALL close the dialog before reloading the page. The dialog SHALL remain open while an account save is pending and when validation, storage or API errors prevent saving.

#### Scenario: Saving General
- **WHEN** a member saves General settings successfully
- **THEN** the dialog closes and the saved preferences are retained

#### Scenario: Saving Account
- **WHEN** the server confirms an Account save
- **THEN** the dialog closes and the success notification remains visible

#### Scenario: Changing the language
- **WHEN** a member saves a changed language
- **THEN** the dialog closes before the page reloads in the selected language

#### Scenario: A pending request
- **WHEN** an Account save has not yet finished
- **THEN** the dialog remains open until the request succeeds

#### Scenario: A refused save
- **WHEN** validation, browser storage or the API prevents saving
- **THEN** the dialog remains open with the error available to the member

### Requirement: Members can choose the color scheme in General

General SHALL offer Light and Dark themes and initially show the current browser preference. Saving General SHALL apply the selected theme throughout the application, retain it in the browser and close the dialog. The existing header theme button SHALL reflect changes made in settings. Closing without saving SHALL discard an unsaved theme selection.

#### Scenario: Saving a different theme
- **WHEN** a member selects Dark in General and saves
- **THEN** the dark theme is applied, the dialog closes and the header button offers the light theme

#### Scenario: Returning after a reload
- **WHEN** a member reloads after saving a theme and reopens General
- **THEN** the saved theme is applied and selected

#### Scenario: Cancelling a selection
- **WHEN** a member chooses another theme and closes settings without saving
- **THEN** the current theme remains and reopening shows the saved preference

### Requirement: General settings captions are not interactive

The language, theme, Telegram and campaign CRM captions in General SHALL be plain text. Clicking a caption SHALL NOT focus or activate a control or change a preference. Selects and switches SHALL retain accessible names and direct pointer and keyboard interaction.

#### Scenario: Clicking a caption
- **WHEN** a member clicks a General setting caption
- **THEN** the associated control does not open, toggle or receive focus and the preference remains unchanged

#### Scenario: Using a control
- **WHEN** a member operates a General select or switch directly
- **THEN** it remains accessible by its setting name and works as before
