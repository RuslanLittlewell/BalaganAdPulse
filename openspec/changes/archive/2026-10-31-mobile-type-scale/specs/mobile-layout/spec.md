## ADDED Requirements

### Requirement: A narrow screen sets text smaller
Below 768 pixels of width, the app SHALL set its text at 0.85 of the size it has on a wide
screen, in proportion across every step of its type scale and their line heights, without
changing spacing or the size of controls. Text set at 10 pixels or less on a wide screen SHALL
keep its size. From 768 pixels of width, text SHALL keep its sizes.

#### Scenario: Body text on a phone
- **WHEN** a member opens the app on a screen 390 pixels wide
- **THEN** text set at 12 pixels on a wide screen is about 10 pixels, and headings shrink by the same proportion

#### Scenario: The smallest labels on a phone
- **WHEN** a member opens the task module on a screen 390 pixels wide
- **THEN** labels set at 8 to 10 pixels on a wide screen keep that size

#### Scenario: Text on a wide screen
- **WHEN** a member opens the app on a screen 1280 pixels wide
- **THEN** text keeps the sizes it has today
