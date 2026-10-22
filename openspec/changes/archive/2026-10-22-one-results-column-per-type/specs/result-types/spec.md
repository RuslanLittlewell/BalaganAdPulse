## MODIFIED Requirements

### Requirement: Results of different types are listed apart

Where a row or the «Итого» row would add results of more than one type, the «Результаты» cell
SHALL show the total number of results and the «Цена результата» cell SHALL be blank. Where all
results are of one type, the cells SHALL show the number and the cost per result as before.

#### Scenario: Mixed totals
- **WHEN** a project's campaigns include messages and profile visits
- **THEN** the «Итого» row shows the total results and no cost per result

#### Scenario: One type
- **WHEN** every campaign collects messages
- **THEN** the «Итого» row shows one number and its cost per result

### Requirement: A column pair per result type

The campaign and ad set tables SHALL offer, for each result type of the project's campaigns on the
project page and of the campaign on the campaign page, one column with the results of that type,
named «Результаты - <тип>» and shown by default. A row SHALL show its results of that type, or a
dash when it has none of that type; the «Итого» row SHALL show the sum of the type. The tables
SHALL NOT offer a column for the cost of a type. Unknown SHALL get a column only when the
campaigns have ad sets with no type.

#### Scenario: Two types
- **WHEN** a project's campaigns optimise for messages and for profile visits
- **THEN** the campaign table shows «Результаты - Сообщения» and «Результаты - Переходы в
  профиль», each campaign filled in its own type and dashed in the other

#### Scenario: A member who chose columns before
- **WHEN** a member who has hidden some columns opens a table that now offers type columns
- **THEN** the type columns are shown and the columns the member hid stay hidden

## REMOVED Requirements

### Requirement: The tables show the result type

**Reason**: A column per result type already says which type each campaign collects.

**Migration**: Read the type from the «Результаты - <тип>» column that holds the campaign's
results.
