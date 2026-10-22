## ADDED Requirements

### Requirement: The columns fit the table's container

A performance table SHALL narrow its figure columns in proportion to their chosen widths, but
never below the minimum column width, whenever their chosen widths together with the name
column would be wider than the table's container, so that the table does not scroll
sideways. The chosen widths SHALL stay remembered and SHALL apply again when the container is
wide enough. When the columns cannot fit even at the minimum width, the table MAY scroll
sideways.

#### Scenario: Turning on more columns
- **WHEN** a member turns on columns until their chosen widths exceed the container
- **THEN** the figure columns narrow and the table shows no horizontal scrollbar

#### Scenario: A menu opens
- **WHEN** the page's available width shrinks because a menu is opened
- **THEN** the table still fits its container without a horizontal scrollbar

#### Scenario: Room again
- **WHEN** the container becomes wide enough for the chosen widths
- **THEN** the columns return to the widths the member chose
