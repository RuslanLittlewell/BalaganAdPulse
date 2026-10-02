## REMOVED Requirements

### Requirement: Projects are ordered by dragging
**Reason**: The priority filter it honours is replaced by a search.
**Migration**: Replaced by "Projects are ordered by dragging and found by searching".

## ADDED Requirements

### Requirement: Projects are ordered by dragging and found by searching

The list SHALL order projects by the member's manual arrangement rather than by priority,
while still showing each project's priority marker. Dragging a project to a new place
SHALL keep it there for that member. A project that has no place in the stored
arrangement — one created since it was last saved — SHALL appear after those that do.

A search field above the list SHALL narrow it to the projects whose name or client name
contains the typed text, ignoring case and leading or trailing spaces. The list SHALL
update once the member pauses typing, not on every keystroke. While a search is active,
pinned projects and groups SHALL show only their matching projects, groups without a match
SHALL be hidden, nothing SHALL be draggable, and a search matching nothing SHALL say so.
The list SHALL NOT offer a priority filter.

#### Scenario: Move a project

- **WHEN** a member drags a project above another
- **THEN** the list shows it in its new place
- **AND** the new order is stored for that member

#### Scenario: A newly created project

- **WHEN** a project is created after the member last arranged the list
- **THEN** it appears at the end of the list

#### Scenario: Searching by name

- **WHEN** a member types part of a project's name in any case and pauses
- **THEN** only the matching projects are shown, in the member's own order, each keeping
  its priority marker

#### Scenario: Searching by client

- **WHEN** a member types part of a client's name
- **THEN** that client's projects are shown

#### Scenario: Typing without pausing

- **WHEN** a member is still typing
- **THEN** the list is not narrowed until they pause

#### Scenario: Nothing matches

- **WHEN** a search matches no project
- **THEN** the list says nothing was found

#### Scenario: Clearing the search

- **WHEN** a member empties the search field
- **THEN** the whole list returns and can be rearranged again

#### Scenario: No priority filter

- **WHEN** a member looks above the list
- **THEN** there is a search field and no priority filter
