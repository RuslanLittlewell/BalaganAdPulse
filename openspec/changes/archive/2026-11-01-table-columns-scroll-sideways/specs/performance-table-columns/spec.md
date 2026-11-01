## MODIFIED Requirements

### Requirement: Every column can be resized

Every column of a performance table SHALL offer a resize handle on its header, operable by
dragging and by the arrow keys, and SHALL NOT shrink below a minimum width. Resizing SHALL move
only the column's right edge: its left edge and the columns to its left SHALL stay where they are,
and the columns to its right SHALL keep their widths. The chosen width SHALL be remembered per
table and per column.

#### Scenario: Widening a figure column
- **WHEN** a member drags the handle of the Расход column to the right
- **THEN** the column widens and keeps that width the next time the table is shown

#### Scenario: Resizing by keyboard
- **WHEN** a member focuses a column's resize handle and presses the right arrow
- **THEN** the column widens by a step, and the left arrow narrows it by a step

#### Scenario: The minimum width
- **WHEN** a member narrows a column past its minimum
- **THEN** the column stays at its minimum width

#### Scenario: Another table
- **WHEN** a member has widened a column in one table
- **THEN** the same column in a different table keeps its own width

#### Scenario: One edge moves
- **WHEN** a member drags the handle of the CPL column to the right
- **THEN** CPL widens by the distance dragged and no other column changes width

## ADDED Requirements

### Requirement: A wide table scrolls sideways

A performance table SHALL draw every figure column at its chosen width whatever the width of its
container. When the columns together are wider than the container, the table SHALL scroll
sideways, and the name column SHALL stay pinned at its left edge while the figure columns scroll
beneath it. When the columns are narrower than the container, the spare width SHALL be left after
the last column, where the column menu sits at the right end.

#### Scenario: More columns than room
- **WHEN** a member turns on columns until their chosen widths exceed the container
- **THEN** every column keeps its chosen width and the table scrolls sideways

#### Scenario: Widening past the edge
- **WHEN** the columns fill the container and a member widens the second figure column
- **THEN** the table grows wider and scrolls sideways, and the third column keeps its width

#### Scenario: Spare room
- **WHEN** the chosen widths of the columns are narrower than the container
- **THEN** each column is drawn at its chosen width and the spare room follows the last column

## REMOVED Requirements

### Requirement: The columns fit the table's container

**Reason**: Squeezing the columns to the container hid the widths members chose, and widening one
column narrowed its neighbours. Members asked for free widths and sideways scrolling back.
**Migration**: None. Saved widths apply as they were saved, and a table wider than its container
scrolls sideways.
