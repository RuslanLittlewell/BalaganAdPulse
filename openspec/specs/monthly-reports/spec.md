# monthly-reports Specification

## Purpose
TBD - created by archiving change client-report-files. Update Purpose after archive.

## Requirements

### Requirement: A customer sees each report as a file

For a customer the Reports module SHALL show, in place of the table, one tile for each report
they may read, newest month first. A tile SHALL show a white file icon, the report's month and
year written out, such as «Сентябрь 2026», and the report's project beneath, and SHALL open
the report. The filter by project SHALL narrow the tiles as it narrows the table. Staff and
guests SHALL keep the table.

#### Scenario: A client opens Отчёты
- **WHEN** a client whose project «Окна» has published August and September reports opens Отчёты
- **THEN** they see two files, «Сентябрь 2026» first and «Август 2026» second, each naming
  «Окна», and no table of figures

#### Scenario: Opening a file
- **WHEN** the client chooses the «Сентябрь 2026» file
- **THEN** the September report opens

#### Scenario: Staff keep the table
- **WHEN** a manager opens Отчёты
- **THEN** the reports are listed in the table with their figures and status

### Requirement: Staff are told that a draft is hidden from the client

Where staff see a draft — on the draft's page beside its status, and under the report list
when any listed report is a draft — the interface SHALL say that the client does not see the
report until it is published.

#### Scenario: A new report
- **WHEN** a manager creates a report and it opens as a draft
- **THEN** the page says the client will not see it until it is published

#### Scenario: A published report
- **WHEN** a manager opens a published report
- **THEN** no such notice is shown

#### Scenario: The list with a draft
- **WHEN** a manager opens Отчёты and one of the listed reports is a draft
- **THEN** the list says that the client does not see drafts until they are published
