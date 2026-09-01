## Purpose

A sheet is the daily metrics table a media buyer actually works in: dated rows, entered
columns such as SPEND and LEADS, and computed columns such as CTR and ROAS that are
derived rather than stored.

## ADDED Requirements

### Requirement: Sheets are addressed as sheets, under a project

A sheet SHALL be addressed at `/api/sheets/:id` and created at
`/api/projects/:projectId/sheets`. The former `/api/campaigns/*` routes SHALL NOT exist.

#### Scenario: Old route is gone
- **WHEN** a client of the API calls `GET /api/campaigns/:id`
- **THEN** the API responds 404 with the standard error envelope

#### Scenario: Sheet tabs within a project
- **WHEN** a member opens a project holding three sheets
- **THEN** the three sheets are presented as tabs, ordered by their position

### Requirement: A new sheet starts with the default column set

Creating a sheet SHALL seed the columns `SPEND`, `IMPRESSIONS`, `CLICKS`, `CTR`, `CPM`,
`CPC`, `LEADS`, `CPL`, `REVENUE`, `ROAS` and `COMMENT`, in that order, alongside the date
that identifies each row.

#### Scenario: Default columns
- **WHEN** a member creates a sheet
- **THEN** those eleven columns exist in that order, with `CTR`, `CPM`, `CPC`, `CPL` and
  `ROAS` carrying formulas and the rest entered by hand

### Requirement: Computed columns are never stored

A column carrying a formula SHALL NOT hold stored values. Its value SHALL be derived from
the entered columns of the same row whenever the row is read.

#### Scenario: Writing to a computed column
- **WHEN** a member sends a value for `CTR`
- **THEN** the API responds 400 and nothing is stored

#### Scenario: Recomputation after an edit
- **WHEN** a member changes `CLICKS` on a row
- **THEN** `CTR`, `CPC` and every other column derived from it are returned recomputed,
  with no second write

### Requirement: One row per day per sheet

A sheet SHALL hold at most one row per date. Adding a row for a date that already exists
SHALL be refused rather than creating a duplicate.

#### Scenario: Duplicate date
- **WHEN** a member adds a row for a date the sheet already has
- **THEN** the API responds 409 and the existing row is unchanged

### Requirement: Sheet data follows the caller's access

Reading and writing sheets, columns, rows and values SHALL be governed by the caller's
access to the owning project, and writes SHALL be refused for roles that may not write.

#### Scenario: Guest reads but cannot write
- **WHEN** a guest granted the owning client opens a sheet
- **THEN** the rows and computed values are returned, and any write is refused with 403
