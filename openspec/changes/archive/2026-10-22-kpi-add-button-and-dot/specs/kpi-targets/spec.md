## MODIFIED Requirements

### Requirement: The project dialog edits the KPIs as blocks

The KPI dialog of a project SHALL show one block per KPI, in order, each with its metric, its
target and a switch that turns the KPI on or off, and one empty block when the project holds no
KPI. It SHALL offer a plus control after the last block that adds an empty block, as long as the
project holds fewer than five blocks and the last block is not itself empty. No block SHALL be
added by filling another. A block SHALL offer removing its KPI. Saving SHALL store the filled
blocks in order, ignore the empty ones and apply the switches. The dialogs of the organization
and of a campaign SHALL stay as they are.

#### Scenario: Adding a second KPI
- **WHEN** a manager opens the dialog of a project holding one KPI and presses the plus control
- **THEN** an empty block follows that KPI's block

#### Scenario: Filling a block adds nothing
- **WHEN** the manager fills the empty block
- **THEN** no other block appears until the plus control is pressed

#### Scenario: Another empty block follows
- **WHEN** the manager has filled the empty block and presses the plus control
- **THEN** a new empty block appears after it

#### Scenario: One empty block at a time
- **WHEN** the last block is empty
- **THEN** the plus control is disabled

#### Scenario: The limit
- **WHEN** the dialog holds five blocks
- **THEN** it offers no plus control

#### Scenario: Switching a KPI off
- **WHEN** the manager turns a block's switch off and saves
- **THEN** the KPI stays in the project, switched off

#### Scenario: Removing a KPI
- **WHEN** the manager removes a block and saves
- **THEN** the project no longer holds that KPI

### Requirement: A project shows one KPI tile per KPI

Where a project's KPI tile is shown, the project page and the page of one of its campaigns,
it SHALL show one tile for each KPI the project holds, in order, each as the KPI tile does for
a single KPI. Every tile and every preview of one in the KPI dialog SHALL carry a small circle
at its top left, green when the KPI counts toward the project's result and grey when it is
switched off, and the circle SHALL be named for assistive technology. A switched-off KPI SHALL
otherwise be drawn like any other. A project without a KPI SHALL show a single tile saying that
no target is set. The control that opens the dialog SHALL be on every tile of a member allowed
to change the KPIs.

#### Scenario: Two KPIs
- **WHEN** a project holds a leads KPI and a CPL KPI
- **THEN** two KPI tiles are shown, in that order, each with a green circle

#### Scenario: A KPI switched off
- **WHEN** one of the KPIs is switched off
- **THEN** its tile carries a grey circle and keeps its figures and status
