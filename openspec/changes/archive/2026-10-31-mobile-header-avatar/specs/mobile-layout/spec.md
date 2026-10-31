## MODIFIED Requirements

### Requirement: A narrow screen gets a compact frame and a bottom navigation bar
Below 768 pixels of width, the app SHALL lay out its frame with narrow margins and gaps around
the content and the navigation, and SHALL fit the visible height of the screen, browser bars
included, so the navigation stays in view. The navigation SHALL sit below the content as one
horizontal row of the modules the member may open, sharing the row's width evenly, each shown
as its icon over its name, the module in view marked as current. It SHALL show neither the brand
nor the section heading, and SHALL offer no control to collapse or expand it, whatever was
chosen on a wide screen. A row wider than the screen SHALL scroll sideways.

From 768 pixels of width, the navigation SHALL remain the side column beside the content, with
its brand, its section heading and its control to collapse and expand it.

#### Scenario: A phone
- **WHEN** a member opens the dashboard on a screen 390 pixels wide
- **THEN** the modules form a row at the bottom of the screen, each with its icon and name, and no control to collapse the navigation is shown

#### Scenario: Collapsed on a laptop
- **WHEN** a member who collapsed the navigation on a laptop opens the app on a phone
- **THEN** the bottom bar still shows each module's name

#### Scenario: A wide screen
- **WHEN** a member opens the app on a screen 1280 pixels wide
- **THEN** the navigation is the side column and can be collapsed and expanded

#### Scenario: Spread across the bar after collapsing
- **WHEN** a member who collapsed the navigation on a laptop opens the app on a phone
- **THEN** the modules are spread evenly across the bottom bar, as they are for a member who did not

## ADDED Requirements

### Requirement: A narrow screen shows only the avatar in the header
Below 768 pixels of width, the user menu in the header SHALL show only the member's avatar,
without their name, email or the menu's chevron; the avatar SHALL still open the menu. From 768
pixels of width, the user menu SHALL show the avatar with the name, the email and the chevron.

#### Scenario: The user menu on a phone
- **WHEN** a member opens the app on a screen 390 pixels wide
- **THEN** the header shows their avatar alone, and tapping it opens the menu with settings and sign-out

#### Scenario: The user menu on a wide screen
- **WHEN** a member opens the app on a screen 1280 pixels wide
- **THEN** the header shows their avatar with their name and email
