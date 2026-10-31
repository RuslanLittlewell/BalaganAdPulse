# mobile-layout Specification

## Purpose
Make the app usable on a phone: a compact frame and navigation within reach of the thumb, while
wide screens keep their layout.

## Requirements

### Requirement: A narrow screen gets a compact frame and a bottom navigation bar
Below 768 pixels of width, the app SHALL lay out its frame with narrow margins and gaps around
the content and the navigation, and SHALL fit the visible height of the screen, browser bars
included, so the navigation stays in view. The navigation SHALL sit below the content as one
horizontal row of the modules the member may open, sharing the row's width evenly, each shown
as its icon over its name, the module in view marked as current. It SHALL show neither the brand
nor the section heading, and SHALL offer no control to collapse or expand it, whatever was
chosen on a wide screen. A row wider than the screen SHALL scroll sideways.

From 768 pixels of width, the navigation SHALL remain the side column beside the content, with
its brand, its section heading and its control to collapse and expand it.

#### Scenario: A phone
- **WHEN** a member opens the dashboard on a screen 390 pixels wide
- **THEN** the modules form a row at the bottom of the screen, each with its icon and name, and no control to collapse the navigation is shown

#### Scenario: Collapsed on a laptop
- **WHEN** a member who collapsed the navigation on a laptop opens the app on a phone
- **THEN** the bottom bar still shows each module's name

#### Scenario: A wide screen
- **WHEN** a member opens the app on a screen 1280 pixels wide
- **THEN** the navigation is the side column and can be collapsed and expanded

#### Scenario: Spread across the bar after collapsing
- **WHEN** a member who collapsed the navigation on a laptop opens the app on a phone
- **THEN** the modules are spread evenly across the bottom bar, as they are for a member who did not

### Requirement: A narrow screen shows only the avatar in the header
Below 768 pixels of width, the user menu in the header SHALL show only the member's avatar,
without their name, email or the menu's chevron; the avatar SHALL still open the menu. From 768
pixels of width, the user menu SHALL show the avatar with the name, the email and the chevron.

#### Scenario: The user menu on a phone
- **WHEN** a member opens the app on a screen 390 pixels wide
- **THEN** the header shows their avatar alone, and tapping it opens the menu with settings and sign-out

#### Scenario: The user menu on a wide screen
- **WHEN** a member opens the app on a screen 1280 pixels wide
- **THEN** the header shows their avatar with their name and email

### Requirement: A narrow screen keeps the task filters behind a button
Below 768 pixels of width, the task module and the archive SHALL show a button with a filter icon
in place of the participant and project filters; the button SHALL open both filters, which SHALL
narrow the list as they do inline. While any participant or project is chosen, the button SHALL
show how many choices are active, visibly and in its accessible name. From 768 pixels of width,
the filters SHALL stay inline in the header without the button.

#### Scenario: Opening the filters on a phone
- **WHEN** a member on a screen 390 pixels wide presses the filter button in the task module
- **THEN** the participant and project filters open, and choosing a project there narrows the tasks to it

#### Scenario: Active filters on a phone
- **WHEN** a member who chose one participant and one project opens the task module on a phone
- **THEN** the filter button shows that two choices are active

#### Scenario: Filters on a wide screen
- **WHEN** a member opens the task module on a screen 1280 pixels wide
- **THEN** the participant and project filters are in the header and no filter button is shown

### Requirement: A narrow screen shows the task header's buttons as icons
Below 768 pixels of width, the task module's Telegram bot button SHALL show only its icon, with
the mark of a linked bot still shown, and the button that creates a task SHALL show only a plus.
Both SHALL keep their names for assistive technology and do what they do on a wide screen. From
768 pixels of width, both SHALL show their names.

#### Scenario: The header on a phone
- **WHEN** a member opens the task module on a screen 390 pixels wide
- **THEN** the Telegram bot button is its icon alone and the create button is a plus, and pressing the plus opens a new task

#### Scenario: The header on a wide screen
- **WHEN** a member opens the task module on a screen 1280 pixels wide
- **THEN** the Telegram bot button and the create button show their names

### Requirement: A narrow screen sets text smaller
Below 768 pixels of width, the app SHALL set its text at 0.85 of the size it has on a wide
screen, in proportion across every step of its type scale and their line heights, without
changing spacing or the size of controls. Text set at 10 pixels or less on a wide screen SHALL
keep its size. From 768 pixels of width, text SHALL keep its sizes.

#### Scenario: Body text on a phone
- **WHEN** a member opens the app on a screen 390 pixels wide
- **THEN** text set at 12 pixels on a wide screen is about 10 pixels, and headings shrink by the same proportion

#### Scenario: The smallest labels on a phone
- **WHEN** a member opens the task module on a screen 390 pixels wide
- **THEN** labels set at 8 to 10 pixels on a wide screen keep that size

#### Scenario: Text on a wide screen
- **WHEN** a member opens the app on a screen 1280 pixels wide
- **THEN** text keeps the sizes it has today

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
