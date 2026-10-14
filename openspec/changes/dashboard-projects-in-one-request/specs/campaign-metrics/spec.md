## ADDED Requirements

### Requirement: Every reachable project's figures are read in one request

The system SHALL offer a reading, over a date range, of every project the member
reaches, returning in one response one entry per project: the project's id, its figures
over the range summed from its campaigns, and its daily series over the range, one entry
per measured day, oldest first. A project with no campaigns, or none measured in the
range, SHALL be listed with zero figures and an empty series. A project the member
cannot reach SHALL never be listed.

The reading SHALL follow the same rules as the agency summary: the member's role must
allow reading campaigns, and a range that ends before it starts SHALL be refused with a
400.

The dashboard's project table SHALL draw every project's row from this one reading, so
the number of requests it makes does not grow with the number of projects.

#### Scenario: Reading every project at once

- **WHEN** a member reads the projects summary over a range
- **THEN** one response holds each project they reach with its totals and its daily
  series over that range

#### Scenario: A project with nothing measured

- **WHEN** a reachable project has no campaigns, or none measured in the range
- **THEN** it is listed with zero spend and an empty daily series

#### Scenario: A member with a partial grant

- **WHEN** a member holding a grant over one project reads the projects summary
- **THEN** only that project is listed

#### Scenario: A range that ends before it starts

- **WHEN** the projects summary is asked for with a range whose end precedes its start
- **THEN** the API responds 400

#### Scenario: The dashboard with many projects

- **WHEN** the dashboard opens for a member who reaches many projects
- **THEN** the project table's figures and sparklines come from a single projects
  summary request, not from a request per project
