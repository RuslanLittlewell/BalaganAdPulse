## Purpose

A fade transition plays when a signed-in member switches between the app's
top-level modules, so the switch reads as a deliberate change of place rather than
an instant cut.

## ADDED Requirements

### Requirement: Fade between modules
Switching between top-level modules (Dashboard, CRM, Projects, Tasks, Reports,
Archive) SHALL cross-fade the outgoing module out and the incoming module in,
rather than swapping instantly.

#### Scenario: Navigating to a different module
- **WHEN** a signed-in member clicks a different module's link in the main
  navigation
- **THEN** the previous module's content fades out while the new module's content
  fades in

### Requirement: Reduced motion is respected
A member who prefers reduced motion SHALL see the new module appear immediately,
without the fade.

#### Scenario: Switching modules with reduced motion preferred
- **WHEN** a member with a reduced-motion preference switches modules
- **THEN** the new module appears without a fade transition

### Requirement: Navigation within a module does not fade
Moving between routes inside the same module SHALL NOT trigger the module fade.

#### Scenario: Switching view within a module
- **WHEN** a member toggles between board and calendar view inside the CRM module
- **THEN** no module-level fade transition plays
