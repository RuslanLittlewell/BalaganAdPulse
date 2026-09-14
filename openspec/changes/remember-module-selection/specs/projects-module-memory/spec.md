## Purpose

Return a member to the project or campaign they last had open in the projects module, with its reporting period, so that moving between modules does not cost them their place.

## ADDED Requirements

### Requirement: Returning to the projects module reopens the last place
When the projects module is opened without a project in the address, it SHALL reopen the project page or campaign page the signed-in person last had open there in this browser, with the reporting period it had, provided that project is still among the projects they can reach. Every project or campaign page the person opens, including by its address, SHALL become the remembered place. The remembered place SHALL belong to the signed-in person, SHALL survive reload, and SHALL NOT be reopened for another person signing in on the same browser. A remembered project the person can no longer reach SHALL be forgotten, and the module SHALL show its unselected state. With nothing remembered, the module SHALL show its unselected state.

#### Scenario: Back to a campaign with its period
- **WHEN** a member opens a campaign of project P for a chosen period, opens another module and returns to projects through the menu
- **THEN** the same campaign page opens with the same period in the address

#### Scenario: Back to a project
- **WHEN** a member last had project P's page open and returns to the projects module
- **THEN** project P's page opens

#### Scenario: The remembered project is gone
- **WHEN** the remembered project was deleted or is no longer reachable
- **THEN** the module shows its unselected state and no longer remembers that project

#### Scenario: Another person on the same browser
- **WHEN** a different person signs in on the browser where project P was remembered
- **THEN** the projects module shows its unselected state for them

#### Scenario: Nothing remembered
- **WHEN** a member opens the projects module for the first time
- **THEN** the unselected state is shown
