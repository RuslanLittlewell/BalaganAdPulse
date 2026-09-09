## ADDED Requirements

### Requirement: Users choose an exact reporting range

Every metrics view SHALL present two date inputs for the inclusive start and end of its reporting range. Each input SHALL support direct entry and a Russian-language calendar. A valid selection SHALL update the range shared by the dashboard, project and campaign views and SHALL be represented in the address so reload and browser navigation preserve it.

#### Scenario: Select a range with calendars

- **WHEN** a user chooses a start date and an end date from the two calendars
- **THEN** every metrics request uses those dates as its inclusive `from` and `to` range

#### Scenario: Enter a range manually

- **WHEN** a user types two valid dates with the start no later than the end
- **THEN** the same range is applied and preserved in the address

#### Scenario: Reject an invalid range

- **WHEN** an entered date is invalid or the start is later than the end
- **THEN** the interface explains the problem in Russian
- **AND** metrics requests continue using the last valid range

#### Scenario: Restore a shared link

- **WHEN** a user opens an address containing a valid start and end date
- **THEN** both date inputs and every metrics view use that range

#### Scenario: Invalid dates in an address

- **WHEN** an address contains missing, malformed or reversed range dates
- **THEN** the interface falls back to the default last-30-days range

