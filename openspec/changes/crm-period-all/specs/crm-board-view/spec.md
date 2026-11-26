## ADDED Requirements

### Requirement: The CRM is limited to an arrival period

The CRM header SHALL offer an arrival period with a button Все and the fields From and To. The board, the table and the tasks view SHALL show only leads that arrived within the period, and the lead count beside the title SHALL count them. A member's first view of a board SHALL start on the current calendar month. The period SHALL be remembered with the member's view of that board. The button Все SHALL remove the period, so that leads of any arrival date are shown, and SHALL show as pressed while no period applies. Choosing a day in either field SHALL release the button, and once both fields hold days the period SHALL apply again. Clearing both fields SHALL remove the period as the button does.

#### Scenario: First visit
- **WHEN** a member opens a board for the first time on 26.11.2026
- **THEN** the fields show 01-11-2026 and 30-11-2026 and only leads that arrived in November are shown

#### Scenario: Showing every period
- **WHEN** the member presses Все
- **THEN** both fields are empty, the button shows as pressed and leads of every arrival date are shown

#### Scenario: Choosing a period after Все
- **WHEN** the member picks 01-10-2026 in From and 31-10-2026 in To after pressing Все
- **THEN** the button is released and only leads that arrived in October are shown

#### Scenario: Returning to the board
- **WHEN** the member presses Все, leaves the CRM and opens the same board again
- **THEN** the button still shows as pressed and leads of every arrival date are shown
