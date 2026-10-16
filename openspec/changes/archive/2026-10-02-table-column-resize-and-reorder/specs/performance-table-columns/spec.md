## ADDED Requirements

### Requirement: Every column can be resized

Every column of a performance table SHALL offer a resize handle on its header, operable by
dragging and by the arrow keys, and SHALL NOT shrink below a minimum width. The chosen
width SHALL be remembered per table and per column.

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
