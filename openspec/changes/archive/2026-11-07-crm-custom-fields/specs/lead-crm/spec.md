## MODIFIED Requirements

### Requirement: The lead card has two columns
Opening a stored lead SHALL show a card with two columns; creating a lead SHALL show the left column alone. The left column SHALL show, from the top: the stage choice; the lead's name as the heading, typed in when creating; one labelled row per field in this order — Сумма сделки, Ответственный, Компания, Метки, Услуга, Номер телефона, Telegram, Мессенджер, Email, Сайт, Источник, then each custom field of the board in the board's order; and the description. The card SHALL offer no campaign choice. The right column SHALL offer the tabs Активность and Файлы, and, for a lead that arrived through an integration, Доп. информация; no other tab. A new lead SHALL be stored only when the member presses Создать, after which the card shows it as a stored lead with both columns; an opened lead's changes SHALL be stored only when the member presses Сохранить. Members who may not edit leads SHALL see every value and no editing control. On a narrow screen the columns SHALL stack.

#### Scenario: Creating a lead
- **WHEN** a member opens the create control, types a name and a phone, and presses Создать
- **THEN** one lead is stored with that name and phone and the card shows it as a saved lead

#### Scenario: Creating shows one column
- **WHEN** a member is creating a lead that is not yet stored
- **THEN** only the left column is shown, and no activity, files or tab are offered

#### Scenario: The field order
- **WHEN** a member opens a lead
- **THEN** the rows read Сумма сделки, Ответственный, Компания, Метки, Услуга, Номер телефона, Telegram, Мессенджер, Email, Сайт, Источник, and no campaign choice is offered

#### Scenario: Custom fields follow the built-in rows
- **WHEN** a member opens a lead on a board whose fields are Бюджет and then Сегмент
- **THEN** the rows Бюджет and Сегмент follow Источник in that order, before the description

#### Scenario: The tabs of a hand-made lead
- **WHEN** a member opens a lead a member created
- **THEN** the right column offers Активность and Файлы and no Доп. информация

#### Scenario: A guest
- **WHEN** a guest opens a lead
- **THEN** every value is shown, the files can be downloaded, and nothing can be changed, attached or removed

### Requirement: A lead's activity is listed
The lead card's Активность tab SHALL list what happened to the lead, newest first: its creation by a member or its import from Meta, each change of a field with the value before and after, each stage move with the stage names, and each file added or removed with its name. A change of a custom field SHALL be listed under the field's current name, with list values given as their options' current names, a checkbox as Да or Нет and a day as `ДД.ММ.ГГГГ`. An option that no longer exists SHALL be shown as удалённый вариант, and changes of a field that no longer exists SHALL NOT be listed. Each entry SHALL name who made it and when; an imported lead's arrival SHALL name no member. The list SHALL be visible to every member who can read the board.

#### Scenario: Reading the history
- **WHEN** a member creates a lead, another changes its phone and then moves it to КП
- **THEN** the activity lists the move to КП, then the phone change with the old and new number, then the creation, each with its member and time

#### Scenario: An imported lead
- **WHEN** a member opens the activity of a lead imported from Meta
- **THEN** its first entry says it arrived from Meta at the form's submission time, naming no member

#### Scenario: A file added
- **WHEN** a member attaches Смета.xlsx to a lead
- **THEN** the activity shows that member added Смета.xlsx

#### Scenario: A custom value changed
- **WHEN** a member changes a lead's Сегмент from Опт to Розница
- **THEN** the activity shows that member changed Сегмент from Опт to Розница

#### Scenario: A field deleted later
- **WHEN** a lead's Бюджет was changed and the field Бюджет was deleted afterward
- **THEN** the activity no longer lists the Бюджет change

### Requirement: Removing a project removes its funnel
Deleting a project SHALL delete every lead, custom column and custom field of its board in the same operation. Deleting a client SHALL do the same for each of its projects. Audit history SHALL be preserved under its existing authorization rules. Other project boards SHALL remain unchanged.

#### Scenario: Project deleted
- **WHEN** an admin deletes a project whose board holds leads, a custom column and a custom field
- **THEN** that board becomes unavailable, its leads, column and field are removed, and other boards are unchanged

#### Scenario: Client deleted
- **WHEN** an admin confirms deletion of a client with two projects holding leads
- **THEN** both boards become unavailable and their leads are removed without affecting other clients' boards
