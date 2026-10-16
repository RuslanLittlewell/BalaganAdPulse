## ADDED Requirements

### Requirement: The hour grid can be zoomed
The calendar SHALL offer, beside Сегодня, the controls Уменьшить масштаб and Увеличить масштаб, which step the hour grid through five scales. The largest scale SHALL be the calendar's default hour height; the smallest SHALL be the height at which all 24 hours fit the calendar's visible height without scrolling, recomputed when that height changes, and never larger than the default. Each control SHALL be unavailable at its end of the range. The calendar SHALL open at the largest scale unless the signed-in person chose another scale in this browser, which SHALL be remembered for that person alone. At scales where an hour is too short for a full card, task cards SHALL show only their title and time on one line. Placing, dragging and dropping tasks SHALL resolve times at the current scale.

#### Scenario: Zooming out to the whole day
- **WHEN** a member presses Уменьшить масштаб until it is unavailable
- **THEN** all 24 hours are visible without scrolling and Увеличить масштаб is available

#### Scenario: Back to the default
- **WHEN** a member presses Увеличить масштаб until it is unavailable
- **THEN** the grid is at its default hour height

#### Scenario: The scale is remembered
- **WHEN** a member zooms out, leaves the tasks module and returns
- **THEN** the calendar opens at the scale they chose

#### Scenario: Compact cards
- **WHEN** the grid is at its smallest scale
- **THEN** each timed task shows its title and time on one line

#### Scenario: Dropping at a small scale
- **WHEN** a member drops a task at the 14:30 line of a zoomed-out grid
- **THEN** the task is rescheduled to 14:30

### Requirement: A calendar card names its assignee on hover
A task card in the calendar that shows its assignee's picture SHALL show the assignee's name in a tooltip when the picture is hovered or focused.

#### Scenario: Hovering the assignee
- **WHEN** a member hovers the assignee picture on a calendar card assigned to Мария
- **THEN** a tooltip reads Мария

