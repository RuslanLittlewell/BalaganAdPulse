## ADDED Requirements

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
