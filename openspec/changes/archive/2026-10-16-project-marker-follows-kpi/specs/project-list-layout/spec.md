## ADDED Requirements

### Requirement: A project's marker follows its KPI

Each project in the wide project list SHALL carry a coloured marker decided by the
project's progress against its own KPI over the selected reporting period, the period the
project's KPI tile uses. Progress SHALL be the percentage achieved as the KPI tile computes
it, counting lower-is-better metrics in their favourable direction, rounded to the whole
percent the tile shows. The marker SHALL be:

- grey when the project has no KPI, or when the KPI's figure is not measured for the period;
- red when progress is below 80%: the project is far behind and needs urgent measures —
  finding the causes, a plan to fix them and follow-up;
- yellow when progress is from 80% up to 100%: the project is somewhat behind and someone
  should look closer and help;
- green when progress is 100% or more: the plan is met or exceeded and nothing is needed.

These are the zones of a campaign's indicator.

Campaign KPIs SHALL NOT stand in for a project without one. The marker SHALL expose its
state to assistive technology rather than through colour alone. It SHALL follow a change
of the period, of the project's figures and of the project's KPI without a reload. The
project's context menu SHALL NOT offer a priority.

#### Scenario: On plan

- **WHEN** a project's KPI is 30 leads for the period and it has 30
- **THEN** its marker is green

#### Scenario: Behind

- **WHEN** a project has 27 leads against a KPI of 30
- **THEN** its marker is yellow

#### Scenario: The lower boundary of yellow

- **WHEN** a project has 24 leads against a KPI of 30
- **THEN** its progress is 80% and its marker is yellow

#### Scenario: A whole month of 31 days

- **WHEN** a project with a KPI of 60 leads a month has 60 leads over all of a 31-day month
- **THEN** its tile shows 100% and its marker is green

#### Scenario: Far behind

- **WHEN** a project has 23 leads against a KPI of 30
- **THEN** its marker is red

#### Scenario: Lower is better

- **WHEN** a project's KPI is a CPA of 10 and its CPA for the period is 12
- **THEN** its progress is 83% and its marker is yellow

#### Scenario: No KPI

- **WHEN** a project has no KPI, even though its campaigns have their own
- **THEN** its marker is grey

#### Scenario: Not measured

- **WHEN** a project's KPI is a CPA and the period has no conversions
- **THEN** its marker is grey

#### Scenario: Another period

- **WHEN** a member selects a period in which the project's progress crosses 100%
- **THEN** its marker turns green without a reload

#### Scenario: Setting a KPI

- **WHEN** a manager sets a KPI on a project whose marker was grey
- **THEN** its marker takes the colour of the new KPI's progress without a reload

#### Scenario: No priority to choose

- **WHEN** an admin opens a project's context menu
- **THEN** it offers no priority

### Requirement: Projects keep the member's order and are found by searching

The list SHALL order projects by the member's manual arrangement rather than by their KPI
progress, while still showing each project's KPI marker. Dragging a project to a new place
SHALL keep it there for that member. A project that has no place in the stored
arrangement — one created since it was last saved — SHALL appear after those that do.

A search field above the list SHALL narrow it to the projects whose name or client name
contains the typed text, ignoring case and leading or trailing spaces. The list SHALL
update once the member pauses typing, not on every keystroke. While a search is active,
pinned projects and groups SHALL show only their matching projects, groups without a match
SHALL be hidden, nothing SHALL be draggable, and a search matching nothing SHALL say so.
The list SHALL NOT offer a filter by the marker's state.

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
  its KPI marker

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

#### Scenario: No marker filter

- **WHEN** a member looks above the list
- **THEN** there is a search field and no filter by the marker's state

## REMOVED Requirements

### Requirement: Projects are ordered by dragging and found by searching

**Reason**: It set the member's manual order against a priority and kept each project's
priority marker visible, and ruled out a priority filter. With the priority gone, the
marker shows the project's KPI progress instead.

**Migration**: Replaced by "Projects keep the member's order and are found by searching",
which keeps ordering, dragging and searching exactly as they were, speaks of the KPI
marker where this spoke of the priority marker, and replaces the no-priority-filter
scenario with a no-marker-filter one.
