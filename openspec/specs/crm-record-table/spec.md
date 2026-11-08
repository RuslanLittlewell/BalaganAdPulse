# crm-record-table Specification

## Purpose
List leads, organizations and people as tables, as Twenty does: one row per record, chosen columns, values edited in place, and a side panel for the whole record with what is related to it.

## Requirements

### Requirement: Organizations and people are listed as tables

Организации and Люди SHALL show the records of the selected board's client as a table, one row per record. The table SHALL have a header row naming its columns. It SHALL scroll in both directions, with the header and the first column kept in view.

Organization columns SHALL be chosen from Название, Сайт, Телефон, Люди (the number of people), Лиды (the number of leads) and Создано. Person columns SHALL be chosen from Имя, Организация, Телефон, Email, Telegram, Мессенджер, Лиды and Создано. The first column SHALL always be the name.

A member who may create leads SHALL find a Добавить control above the table. It SHALL open a creation side panel with all organization fields (name, website, phone, notes) or all person fields (name, organization, phone, email, Telegram, messenger, notes), as appropriate. The record SHALL be created only when the member submits the panel with a valid name and valid optional values. A failed save SHALL keep the entered values and show the reason. Closing the panel SHALL leave no record.

#### Scenario: The people table
- **WHEN** a member opens Люди for a client with Анна of Ромашка and Борис without an organization
- **THEN** the table shows a row for each with their names, Ромашка beside Анна, and an empty organization cell for Борис

#### Scenario: Adding an organization
- **WHEN** a member presses Добавить on Организации, fills the creation panel with Лютик and a website, and submits it
- **THEN** a row Лютик appears and its panel opens

#### Scenario: Adding a person
- **WHEN** a member presses Добавить on Люди, fills the creation panel with Анна, a phone and Ромашка as her organization, and submits it
- **THEN** Анна is created with those values and her record panel opens

### Requirement: Cells are edited in place

For members who may update leads, cells of text, phone, email, address and number values SHALL be editable in place, the same way the side panel edits values:
- Enter or leaving the cell stores that one value.
- Escape restores the stored value.
- An invalid value stays open with the reason and is not stored.

Other cells, and the name column's open control, SHALL open the record's side panel. Guests SHALL see values without editors.

#### Scenario: Editing a phone in the table
- **WHEN** a member activates Анна's phone cell, types +375291112233 and presses Enter
- **THEN** only Анна's phone is stored and the cell shows the new number

### Requirement: The view bar works on organizations and people

Организации and Люди SHALL offer the view bar with search, Фильтр, Сортировка and Настройки.
- Search SHALL match the name, phone, email, Telegram, messenger and organization of the shown records.
- Фильтр and Сортировка SHALL offer the table's fields, with the operators of their types.
- Настройки SHALL choose which columns are shown and in what order.

These settings SHALL be remembered per person and client in the browser, separately for Организации and Люди.

#### Scenario: Filtering people by organization
- **WHEN** a member filters Люди by Организация любой из Ромашка
- **THEN** only Ромашка's people remain listed

### Requirement: Leads have a table layout

Настройки on the leads page SHALL offer Таблица next to Канбан and Календарь. The table SHALL list the leads that pass the search and filters:
- one row per lead;
- the name first and the stage as a colored pill;
- the chosen card fields as further columns, in their order.

Without a sort the rows SHALL follow the board order, column by column. With a sort, they SHALL follow the sort. Clicking a row SHALL open the lead's side panel.

#### Scenario: Leads as a table
- **WHEN** a member picks Таблица for a board with leads in Новый and КП
- **THEN** the leads are rows, Новый's before КП's, each with its stage pill and the chosen card fields

### Requirement: Organizations and people open in a side panel

Clicking a row SHALL open the record in a side panel on the right, which follows the same opening, closing and editing rules as the lead's panel. The panel SHALL show the record's fields grouped and edited in place, and SHALL offer Удалить in its menu to members who may delete leads.

All CRM side panels, including creation panels, SHALL overlay the right side of the table or board with a visible shadow. Opening or closing a panel SHALL NOT resize or shift the content beneath it. Panels SHALL visibly slide and fade in when opened and slide and fade out when closed. The close animation SHALL finish before the panel is removed. Reduced-motion preferences SHALL be respected.

Below the fields, the panel SHALL list related records:
- An organization's panel lists its people and its leads.
- A person's panel lists its leads and links to its organization.

Each listed lead SHALL show its name, stage pill and board. Choosing a lead SHALL open it on its board. Leads on boards the member does not reach SHALL be left out of the lists.

#### Scenario: An organization's leads
- **WHEN** a member opens Ромашка, whose leads sit on the boards Сайт and Реклама, and the member reaches only Сайт
- **THEN** the panel lists Ромашка's people and only the lead on Сайт

#### Scenario: Going to a lead
- **WHEN** a member chooses a lead listed in a person's panel
- **THEN** the leads page opens on that lead's board with the lead's panel open
