## ADDED Requirements

### Requirement: A narrow screen opens a task as a full-screen sheet
Below 768 pixels of width, a task SHALL open over the whole screen and scroll as one page. A bar
across its top SHALL hold a control that closes the task, the task dialog's title and, where the
member may change the task, the button that saves it; the bar SHALL stay in view while the page
scrolls. Below the task's title the page SHALL show its stage and priority, then its dates,
project and participants, then its description, checklist, attachments and comments, and last
the choice to show it to the client and the control to delete it, where the member has them. The
read-only view of a task SHALL also open over the whole screen. From 768 pixels of width, both
SHALL open as the centred dialog with its two columns.

#### Scenario: Editing a task on a phone
- **WHEN** a member opens a task on a screen 390 pixels wide
- **THEN** it fills the screen, the bar at its top holds the close control and the save button, and the stage and priority come right after the title

#### Scenario: Saving from the top bar
- **WHEN** a member creating a task on a phone types its title and presses the save button in the top bar
- **THEN** the task is created and the sheet closes

#### Scenario: A read-only task on a phone
- **WHEN** a member who may only view a task opens it on a phone
- **THEN** the top bar holds a control to close it and no save button

#### Scenario: A task on a wide screen
- **WHEN** a member opens a task on a screen 1280 pixels wide
- **THEN** it opens as the centred dialog with the stage and priority in its header and the save button in its footer
