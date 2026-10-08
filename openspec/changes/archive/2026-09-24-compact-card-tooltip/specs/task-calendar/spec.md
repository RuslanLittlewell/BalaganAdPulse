## ADDED Requirements

### Requirement: A compact calendar card tells its details on hover
When the calendar shows a task as a compact card, hovering or focusing the card SHALL show a tooltip with the task's full title, its time, its project and its assignee, leaving out what the task does not have. Dragging the card SHALL NOT be prevented by the tooltip.

#### Scenario: Hovering a compact card
- **WHEN** a member hovers a compact card of the task Созвон at 10:00 on project Сайт assigned to Мария
- **THEN** a tooltip shows Созвон, 10:00, Сайт and Мария

#### Scenario: A full-size card
- **WHEN** a member hovers a full-size card
- **THEN** no details tooltip is shown for the card
