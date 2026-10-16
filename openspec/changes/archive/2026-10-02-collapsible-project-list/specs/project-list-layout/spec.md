## ADDED Requirements

### Requirement: The project list can be narrowed to pictures

A handle SHALL sit on the border between the project list and the project, half-way down
its height. Choosing it SHALL narrow the list to the projects' pictures alone, and choosing
it again SHALL widen it back. The handle SHALL name the action it performs and expose
whether the list is expanded. The choice SHALL be remembered in the member's browser.

While narrowed, each project SHALL show only its picture; hovering or focusing it SHALL
show the project's name in a tooltip, and choosing it SHALL open the project as before.
Pinned projects SHALL stay above the rest, groups SHALL keep their projects together with
the group's name in a tooltip, and nothing SHALL be draggable. The search SHALL become a
magnifier control that opens a small field, in the same kind of floating surface as the
context menu, which narrows the list as the search field does.

#### Scenario: Narrowing the list
- **WHEN** a member chooses the handle on the border
- **THEN** the list shows only the projects' pictures and the handle offers to widen it

#### Scenario: A project's name
- **WHEN** a member hovers a project's picture in the narrowed list
- **THEN** a tooltip shows the project's name

#### Scenario: Searching while narrowed
- **WHEN** a member chooses the magnifier and types part of a project's name
- **THEN** only the matching projects' pictures are shown

#### Scenario: Remembered
- **WHEN** a member who narrowed the list opens the projects module again
- **THEN** the list is still narrowed

### Requirement: A project can be edited from its context menu

A project's context menu SHALL offer Редактировать to a member who may update projects,
in the wide and the narrowed list alike, opening the project form for that project.

#### Scenario: Editing from the menu
- **WHEN** a member who may update projects chooses Редактировать in a project's context menu
- **THEN** the project form opens for that project

#### Scenario: No permission
- **WHEN** a member who may not update projects opens a project's context menu
- **THEN** Редактировать is not offered
