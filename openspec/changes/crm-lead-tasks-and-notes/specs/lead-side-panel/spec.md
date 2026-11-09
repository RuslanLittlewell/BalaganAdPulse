## MODIFIED Requirements

### Requirement: A lead opens in a side panel

Opening a lead from the board, from the tasks or from the table SHALL show a panel at the right edge of the CRM. The layout SHALL stay visible and usable beside it. Opening another lead SHALL replace the panel's lead. The panel SHALL close on its close button or on Escape, when no editor inside it is open. The open lead SHALL be named in the page address, so that reloading the page or following the address reopens it. An address naming a lead that is not on the selected board, or that the member cannot reach, SHALL open no panel and show no error. On a narrow screen the panel SHALL cover the board until it is closed. Changing the selected board SHALL close the panel.

#### Scenario: Opening and switching
- **WHEN** a member clicks one lead's card and then another's
- **THEN** the panel shows the second lead and the board stays visible beside it

#### Scenario: Reloading with a lead open
- **WHEN** a member reloads the page while a lead's panel is open
- **THEN** the same lead's panel is open after the reload

#### Scenario: A lead from another board
- **WHEN** the address names a lead of a board other than the selected one
- **THEN** no panel opens and the board is shown as usual

### Requirement: The panel offers its tabs

The panel SHALL offer the tabs Поля, Задачи, Заметки, Активность and Файлы, in that order. A lead that arrived through an integration SHALL also get Информация, last. Поля SHALL be shown first when a lead opens. Активность, Файлы and Информация SHALL keep the content and permissions they had in the lead card. Задачи and Заметки SHALL have the content described in the lead-tasks and lead-notes capabilities.

#### Scenario: A hand-made lead
- **WHEN** a member opens a lead a member created
- **THEN** the panel offers Поля, Задачи, Заметки, Активность and Файлы and no Информация

#### Scenario: An imported lead
- **WHEN** a member opens a lead that arrived through Meta
- **THEN** the panel offers the five tabs and Информация after them

## ADDED Requirements

### Requirement: The panel is wide enough for its tabs

On a screen wide enough to show the panel beside the board, the panel SHALL be wide enough to show every tab on one row without scrolling the row and without cutting any tab's name, including the sixth tab of an imported lead. The panel SHALL NOT be wider than the space beside the board allows. On a narrow screen the panel SHALL keep covering the board.

#### Scenario: All tabs of an imported lead
- **WHEN** a member opens an imported lead on a desktop screen
- **THEN** the six tab names are readable on one row

#### Scenario: A small laptop screen
- **WHEN** the window is narrower than the panel's preferred width
- **THEN** the panel fills the available width and the tabs stay reachable
