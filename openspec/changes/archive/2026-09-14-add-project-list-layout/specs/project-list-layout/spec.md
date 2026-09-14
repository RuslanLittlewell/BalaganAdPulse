## Purpose

Each member keeps their own arrangement of the project list — the order of its items, the projects pinned above it and the groups projects are collected into — so the list matches how that person works without changing what anyone else sees.

## ADDED Requirements

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

### Requirement: Projects are ordered by dragging

The list SHALL order projects by the member's manual arrangement rather than by priority, while still showing each project's priority marker and honouring the priority filter. Dragging a project to a new place SHALL keep it there for that member. A project that has no place in the stored arrangement — one created since it was last saved — SHALL appear after those that do.

#### Scenario: Move a project

- **WHEN** a member drags a project above another
- **THEN** the list shows it in its new place
- **AND** the new order is stored for that member

#### Scenario: A newly created project

- **WHEN** a project is created after the member last arranged the list
- **THEN** it appears at the end of the list

#### Scenario: Priority still marks and filters

- **WHEN** a member filters the list by priority
- **THEN** only projects of that priority are shown, each keeping its priority marker, in the member's own order

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
