# performance-table-columns Specification

## Purpose
TBD - created by archiving change table-column-resize-and-reorder. Update Purpose after archive.

## Requirements

### Requirement: Every column can be resized

Every column of a performance table SHALL offer a resize handle on its header, operable by
dragging and by the arrow keys, and SHALL NOT shrink below a minimum width. Resizing SHALL move
only the column's right edge: its left edge and the columns to its left SHALL stay where they are.
The chosen width SHALL be remembered per table and per column.

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
- **WHEN** a member drags the handle of the CPL column to the right in a table narrower than its container
- **THEN** CPL widens by the distance dragged and no other column changes width

### Requirement: Figure columns can be reordered from their header

Hovering or focusing a figure column's header SHALL reveal a control that moves the column
one place to the left and one that moves it one place to the right. The name column SHALL
stay first and offer neither. The first figure column SHALL offer no move to the left and
the last no move to the right. The order SHALL be remembered per table.

#### Scenario: Moving a column right
- **WHEN** a member chooses move right on the Расход header
- **THEN** Расход swaps places with the column after it, in the header, every row and the
  totals

#### Scenario: Edges
- **WHEN** a member looks at the controls of the first and last figure columns
- **THEN** the first offers no move left and the last offers no move right

#### Scenario: Remembered order
- **WHEN** a member has moved a column and the table is shown again
- **THEN** the columns appear in the order they left them

#### Scenario: A hidden column keeps its place
- **WHEN** a member hides a column and later shows it again
- **THEN** it returns to the place it held in their order

#### Scenario: A column the saved order does not know
- **WHEN** a table gains a column after a member saved their order
- **THEN** the new column appears after the columns of the saved order

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

### Requirement: The columns fit the table's container

A performance table SHALL narrow its figure columns in proportion to their chosen widths, but
never below the minimum column width, whenever their chosen widths together with the name
column would be wider than the table's container, so that the table does not scroll
sideways. The chosen widths SHALL stay remembered and SHALL apply again when the container is
wide enough. When the columns cannot fit even at the minimum width, the table MAY scroll
sideways. While the columns are narrower than the container, they SHALL keep their chosen widths
and the spare width SHALL be left after the last column, where the column menu sits at the right
end. Widening a column while the columns fill the container SHALL take the width from the columns
to its right, nearest first, down to their minimum width, and SHALL remember the widths so drawn.

#### Scenario: Turning on more columns
- **WHEN** a member turns on columns until their chosen widths exceed the container
- **THEN** the figure columns narrow and the table shows no horizontal scrollbar

#### Scenario: A menu opens
- **WHEN** the page's available width shrinks because a menu is opened
- **THEN** the table still fits its container without a horizontal scrollbar

#### Scenario: Room again
- **WHEN** the container becomes wide enough for the chosen widths
- **THEN** the columns return to the widths the member chose

#### Scenario: Spare room
- **WHEN** the chosen widths of the columns are narrower than the container
- **THEN** each column is drawn at its chosen width and the spare room follows the last column

#### Scenario: Widening at capacity
- **WHEN** the columns fill the container and a member widens the second figure column
- **THEN** the third column narrows by as much and the first keeps its width

### Requirement: Each advertising account keeps its own column layout

A project's campaign table SHALL remember its visible columns, their order and their widths for
each advertising account apart, under the account chosen in its account tabs, and a campaign's ad
set table SHALL remember them for the campaign's account. A table without an account SHALL keep one
layout as before. The first time an account's table is shown, its layout SHALL start as a copy of
the layout the table had before layouts were kept per account; later changes SHALL apply to that
account alone.

#### Scenario: Two accounts
- **WHEN** a member hides the CPL column on the first account's tab and opens the second account's tab
- **THEN** the second account's table still shows CPL

#### Scenario: Coming back
- **WHEN** the member returns to the first account's tab
- **THEN** CPL is still hidden there

#### Scenario: An account seen for the first time
- **WHEN** a member who had narrowed the Показы column before opens an account's tab for the first time
- **THEN** Показы has the narrowed width there too
