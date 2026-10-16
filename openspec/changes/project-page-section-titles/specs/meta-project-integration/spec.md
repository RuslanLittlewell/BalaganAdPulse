## ADDED Requirements

### Requirement: The connections block is titled
A project page's block of advertising connections SHALL open with a second-level heading,
Интеграции, styled like the other section titles of the page. The heading SHALL be shown
exactly when the block is: a member who may not manage integrations sees neither.

#### Scenario: A member who manages integrations
- **WHEN** a manager opens a project page
- **THEN** the connections and the control to add one sit under the heading Интеграции

#### Scenario: A guest
- **WHEN** a guest opens a project page
- **THEN** no Интеграции heading is shown
