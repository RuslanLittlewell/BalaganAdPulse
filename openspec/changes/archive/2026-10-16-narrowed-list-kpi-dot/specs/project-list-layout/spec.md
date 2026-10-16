## MODIFIED Requirements

### Requirement: A project's marker follows its KPI

Each project in the project list, wide or narrowed, SHALL carry a coloured marker decided by
the project's progress against its own KPI over the selected reporting period, the period the
project's KPI tile uses. Progress SHALL be the percentage achieved as the KPI tile computes
it, counting lower-is-better metrics in their favourable direction, rounded to the whole
percent the tile shows. The marker SHALL be:

- grey when the project has no KPI, or when the KPI's figure is not measured for the period;
- red when progress is below 80%: the project is far behind and needs urgent measures —
  finding the causes, a plan to fix them and follow-up;
- yellow when progress is from 80% up to 100%: the project is somewhat behind and someone
  should look closer and help;
- green when progress is 100% or more: the plan is met or exceeded and nothing is needed.

These are the zones of a campaign's indicator. In the wide list the marker SHALL be a bar
beside the project; in the narrowed list it SHALL be a small circle on the project's picture.

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

#### Scenario: The narrowed list

- **WHEN** a member narrows the list and a project's KPI is far behind
- **THEN** the project's picture carries a small red circle, and the project is described to
  assistive technology as seriously behind its KPI

### Requirement: The project list can be narrowed to pictures

A handle SHALL sit on the border between the project list and the project, half-way down
its height. Choosing it SHALL narrow the list to the projects' pictures alone, and choosing
it again SHALL widen it back. The handle SHALL name the action it performs and expose
whether the list is expanded. The choice SHALL be remembered in the member's browser.

While narrowed, each project SHALL show only its picture, with its KPI marker as a small
circle on it; hovering or focusing it SHALL
show the project's name in a tooltip, and choosing it SHALL open the project as before.
Pinned projects SHALL stay above the rest, groups SHALL keep their projects together with
the group's name in a tooltip, and nothing SHALL be draggable. The search SHALL become a
magnifier control that opens a small field, in the same kind of floating surface as the
context menu, which narrows the list as the search field does.

#### Scenario: Narrowing the list
- **WHEN** a member chooses the handle on the border
- **THEN** the list shows only the projects' pictures, each with its KPI marker, and the
  handle offers to widen it

#### Scenario: A project's name
- **WHEN** a member hovers a project's picture in the narrowed list
- **THEN** a tooltip shows the project's name

#### Scenario: Searching while narrowed
- **WHEN** a member chooses the magnifier and types part of a project's name
- **THEN** only the matching projects' pictures are shown

#### Scenario: Remembered
- **WHEN** a member who narrowed the list opens the projects module again
- **THEN** the list is still narrowed
