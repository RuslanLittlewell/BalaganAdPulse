## Purpose

Make the app usable on a phone: a compact frame and navigation within reach of the thumb, while
wide screens keep their layout.

## ADDED Requirements

### Requirement: A narrow screen gets a compact frame and a bottom navigation bar
Below 768 pixels of width, the app SHALL lay out its frame with narrow margins and gaps around
the content and the navigation, and SHALL fit the visible height of the screen, browser bars
included, so the navigation stays in view. The navigation SHALL sit below the content as one
horizontal row of the modules the member may open, each shown as its icon over its name, the
module in view marked as current. It SHALL show neither the brand nor the section heading, and
SHALL offer no control to collapse or expand it, whatever was chosen on a wide screen. A row
wider than the screen SHALL scroll sideways.

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
