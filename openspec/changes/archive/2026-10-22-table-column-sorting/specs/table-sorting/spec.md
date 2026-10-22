## Purpose

Lets a member order any table by one of its data columns, ascending or descending, to find
the largest, smallest, newest or oldest row without reading the whole table.

## ADDED Requirements

### Requirement: Data columns can be sorted from their header

Every data column of the performance tables, the organizations table and the reports list
SHALL expose its header as a control that sorts the table by that column. Choosing a header
that is not the sorted one SHALL sort descending, largest or last first; choosing the sorted
header SHALL flip to ascending; choosing it once more SHALL restore the table's original
order. The header of the
sorted column SHALL announce its direction, and the other headers SHALL announce that they
are not sorted. Columns that hold only controls SHALL NOT be sortable.

#### Scenario: The first choice sorts descending
- **WHEN** a member chooses the Расход header
- **THEN** the rows are ordered by spend from largest to smallest and the header announces
  a descending sort

#### Scenario: Flipping the direction
- **WHEN** a member chooses the header of the column the table is already sorted by
- **THEN** the rows are ordered from smallest to largest and the header announces an
  ascending sort

#### Scenario: Restoring the original order
- **WHEN** a member chooses the header of a column sorted ascending
- **THEN** the rows return to the order the table had before any sorting and no header
  announces a sort

#### Scenario: Switching column
- **WHEN** a table is sorted by one column and a member chooses another header
- **THEN** the table sorts descending by the new column and the previous header announces
  no sort

#### Scenario: Row actions
- **WHEN** a table has a column of row actions
- **THEN** its header offers no sorting

### Requirement: Rows without a value come last

A row with no value in the sorted column SHALL appear after every row that has one, in both
directions.

#### Scenario: A missing figure
- **WHEN** a table is sorted by Цена результата and one row has none
- **THEN** that row is last whether the sort is ascending or descending

### Requirement: Values are compared by their kind

Text SHALL be compared alphabetically by the Russian locale, numbers by value and dates by
moment, so that 9 precedes 10 and an earlier date precedes a later one.

#### Scenario: Numbers
- **WHEN** rows with spend 9 and 10 are sorted ascending
- **THEN** 9 comes before 10

#### Scenario: Names
- **WHEN** organizations are sorted by name ascending
- **THEN** they follow the Russian alphabetical order regardless of letter case

### Requirement: Performance tables keep their hierarchy

A performance table SHALL sort the rows of each level among themselves, so that every
expandable row keeps its children beneath it, and SHALL leave the totals row in place.

#### Scenario: Sorting expanded campaigns
- **WHEN** a project is expanded and the table is sorted by Расход
- **THEN** the projects are ordered by spend and each expanded project's campaigns are
  ordered by spend directly beneath it

#### Scenario: Totals
- **WHEN** a table with a totals row is sorted
- **THEN** the totals row stays last and its figures do not change
