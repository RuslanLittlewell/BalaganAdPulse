## ADDED Requirements

### Requirement: The name column is always shown

Every performance table SHALL always show its name column — campaign, project, ad set or
ad — pinned first. The column chooser SHALL NOT offer it, and a choice saved before this
rule that hid it SHALL be shown with the name column restored. At least one figure column
SHALL remain beside it.

#### Scenario: The chooser
- **WHEN** a member opens a table's column chooser
- **THEN** it lists the figure columns only, and not the name column

#### Scenario: A choice that hid the name
- **WHEN** a member's saved column choice left out the name column
- **THEN** the table shows the name column with the rest of that choice

#### Scenario: Keeping a figure
- **WHEN** a member turns off every figure column but one
- **THEN** the last one cannot be turned off
