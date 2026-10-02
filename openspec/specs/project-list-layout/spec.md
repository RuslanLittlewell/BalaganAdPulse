# project-list-layout Specification

## Purpose

Each member keeps their own arrangement of the project list — the order of its items, the projects pinned above it and the groups projects are collected into — so the list matches how that person works without changing what anyone else sees.

## Requirements

### Requirement: A member arranges the project list for themselves alone

The project list SHALL be shown in the order the viewing member arranged, and that arrangement SHALL be stored against that member. Reading or changing one member's arrangement SHALL NOT change or expose another member's. The arrangement SHALL survive reload and SHALL cover only projects the member may reach; a project the member cannot reach SHALL NOT appear in it.

#### Scenario: Two members arrange the same projects

- **WHEN** one member reorders the list
- **THEN** their own list keeps the new order
- **AND** another member's list is unchanged

#### Scenario: An arrangement outlives the session

- **WHEN** a member returns after reloading
- **THEN** the list appears in the order they left it

#### Scenario: An arrangement naming an unreachable project

- **WHEN** an arrangement is saved naming a project the member may not reach
- **THEN** the API responds 404 and the stored arrangement is unchanged

### Requirement: A pinned project sits above the list

A project's context menu SHALL offer pinning and, for a pinned project, unpinning. Pinned projects SHALL be shown above every other item, separated from them by a thick border, and SHALL NOT be draggable nor accept anything dragged onto them. Pinning a project held by a group SHALL take it out of that group.

#### Scenario: Pin a project

- **WHEN** a member chooses “Закрепить” on a project
- **THEN** the project moves above the rest of the list, behind the separating border
- **AND** it can no longer be dragged

#### Scenario: Unpin a project

- **WHEN** a member chooses “Открепить” on a pinned project
- **THEN** the project returns to the draggable part of the list

#### Scenario: Pin a project out of a group

- **WHEN** a member pins a project that a group holds
- **THEN** the group no longer holds it and the project appears among the pinned ones

### Requirement: A member collects projects into groups

The context menu of the list area SHALL offer creating a group, which SHALL ask for the group's name in a dialog and SHALL refuse an empty name. A group SHALL be shown as a card the size of a project, with a dashed border and a header carrying its name, and SHALL be created empty at the end of the list. A group SHALL belong to the member who created it.

#### Scenario: Create a group

- **WHEN** a member chooses “Создать группу” and confirms a name
- **THEN** an empty group with that name appears at the end of their list

#### Scenario: A group without a name

- **WHEN** a member confirms the dialog with an empty name
- **THEN** the dialog explains that a name is required and no group is created

#### Scenario: Another member's list

- **WHEN** a member creates a group
- **THEN** no other member's list shows it

### Requirement: Groups and their contents move by dragging

A project SHALL be draggable into a group, out of a group into the list, and between groups; a group SHALL be draggable among the top-level items of the list, carrying its projects with it. The order of projects inside a group SHALL be arranged by dragging as well.

#### Scenario: Drag a project into a group

- **WHEN** a member drags a project onto a group
- **THEN** the group holds it in the place it was dropped
- **AND** it is no longer among the top-level items

#### Scenario: Drag a project out of a group

- **WHEN** a member drags a project from a group into the list
- **THEN** the project takes its place among the top-level items and the group no longer holds it

#### Scenario: Move a whole group

- **WHEN** a member drags a group to another place in the list
- **THEN** the group and the projects it holds appear in that place

### Requirement: Only an empty group is deleted

A group's context menu SHALL offer deleting it. Deleting SHALL be refused while the group holds any project, and the refusal SHALL leave the group and its projects untouched. Deleting an empty group SHALL remove it from the member's list only.

#### Scenario: Delete an empty group

- **WHEN** a member deletes a group holding no projects
- **THEN** the group disappears from their list

#### Scenario: Delete a group holding projects

- **WHEN** a member attempts to delete a group that holds projects
- **THEN** the group is kept, the interface says in Russian that it must be emptied first, and the API responds 409 to such a request

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
