# alerts Specification

## Purpose
TBD - created by archiving change swipe-toast-alerts. Update Purpose after archive.

## Requirements

### Requirement: Alerts appear as swipeable toasts
An alert raised by any screen SHALL appear as a toast in the bottom-right corner of the window, outside the control that raised it, with its message and an icon for its tone. Several alerts SHALL stack rather than replace one another. An alert SHALL leave by itself after 8 seconds, SHALL pause that countdown while hovered or focused, and SHALL show the time left as a draining line. A member SHALL be able to dismiss an alert by swiping it down, by its close control, or with Escape while it has focus. An error SHALL be announced to assistive technology as an alert and a success as a status. Under a reduced-motion preference the toast SHALL fade rather than slide.

#### Scenario: An error is raised
- **WHEN** saving a lead fails
- **THEN** a toast with the error appears in the bottom-right corner, announced as an alert, outside the lead card

#### Scenario: A success is raised
- **WHEN** a profile is saved
- **THEN** a toast saying so appears, announced as a status

#### Scenario: Several alerts
- **WHEN** two alerts are raised one after the other
- **THEN** both are shown

#### Scenario: Dismissing
- **WHEN** a member activates an alert's close control
- **THEN** the alert disappears and the others stay

#### Scenario: Leaving by itself
- **WHEN** an alert's time runs out
- **THEN** it disappears without being touched
