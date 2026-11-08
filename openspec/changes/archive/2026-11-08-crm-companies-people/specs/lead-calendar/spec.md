## MODIFIED Requirements

### Requirement: CRM offers a board and a calendar

The CRM screen SHALL offer three layouts of the selected board's leads, `Канбан`, `Календарь` and `Таблица`, chosen under Раскладка in the view bar's Настройки. Exactly one SHALL be shown at a time, and the menu SHALL show which one is selected. The calendar SHALL show only leads that pass the view bar's search and filters, and SHALL open a lead in the side panel.

The chosen layout SHALL be remembered for that person in that browser and SHALL be the layout they return to, independently of which board is selected. A person who has never chosen SHALL see the board.

#### Scenario: Switching to the calendar
- **WHEN** a member picks `Календарь` under Раскладка
- **THEN** the board is replaced by the calendar for the currently selected board, and Раскладка marks `Календарь` as selected

#### Scenario: The calendar honors the filter
- **WHEN** a member has a filter Ответственный любой из Мария and switches to `Календарь`
- **THEN** the calendar shows only Мария's leads

#### Scenario: The choice outlives the session
- **WHEN** a member who last used the calendar reloads the CRM screen
- **THEN** the calendar is shown

#### Scenario: A first visit
- **WHEN** a member opens CRM having never chosen a layout
- **THEN** the board is shown

#### Scenario: Another person on the same browser
- **WHEN** a different person signs in on the same browser
- **THEN** their own remembered layout is used, and the board if they have none

#### Scenario: Switching boards keeps the view
- **WHEN** a member on the calendar switches from client A's board to client B's
- **THEN** the calendar stays shown, now for client B's leads
