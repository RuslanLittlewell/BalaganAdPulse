# signed-out-theme Specification

## Purpose
TBD - created by archiving change signed-out-theme-toggle. Update Purpose after archive.

## Requirements

### Requirement: The colour scheme can be switched before signing in

The panel of the sign-in, registration and password-reset screens, and of the suspended
organization screen, SHALL show, at the right of its title and on the title's line, the same theme
toggle as the app header, named for the scheme it switches to. Pressing it SHALL switch the colour
scheme at once and remember the choice as the header's toggle does, so it SHALL still apply after
signing in.

#### Scenario: On the sign-in screen
- **WHEN** a visitor using the light scheme opens the sign-in screen
- **THEN** a control named «Включить тёмную тему» is shown at the right of the title «Вход»

#### Scenario: Switching
- **WHEN** the visitor presses it
- **THEN** the dark scheme applies and the control is named «Включить светлую тему»

#### Scenario: On the registration screen
- **WHEN** an invited person opens the registration screen
- **THEN** the theme toggle is shown beside its title too
