## ADDED Requirements

### Requirement: The project list is a dropdown where the projects module has no side column
Below 1024 pixels of width, the projects module SHALL show, in place of its project list, a
button naming the chosen project and its client, or asking for a project when none is chosen.
The button SHALL open the whole list over the page, with its search, pinned projects, groups and
the control to create a project; choosing a project there SHALL open it and close the list. The
list SHALL show each project's name whether or not it was collapsed on a wide screen. From 1024
pixels of width, the list SHALL remain the side column, collapsible as before.

#### Scenario: Choosing a project on a phone
- **WHEN** a member on a screen 390 pixels wide presses the button naming the chosen project and picks another project in the list
- **THEN** that project opens and the list closes

#### Scenario: No project chosen on a phone
- **WHEN** a member opens the projects module on a phone without a chosen project
- **THEN** the button asks for a project, and pressing it opens the list

#### Scenario: A list collapsed on a laptop
- **WHEN** a member who collapsed the project list on a laptop opens the list on a phone
- **THEN** the list shows each project's name

#### Scenario: A wide screen
- **WHEN** a member opens the projects module on a screen 1280 pixels wide
- **THEN** the project list is the side column and no dropdown button is shown
