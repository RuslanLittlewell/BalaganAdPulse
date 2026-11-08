# lead-side-panel Specification

## Purpose
Show and edit one lead in a panel beside the board, as Twenty does, so a member reads and changes a lead without losing sight of the board, and every value is saved as soon as it is edited.

## Requirements

### Requirement: A lead opens in a side panel

Opening a lead from the board or the calendar SHALL show a panel at the right edge of the CRM. The board or calendar SHALL stay visible and usable beside it. Opening another lead SHALL replace the panel's lead. The panel SHALL close on its close button or on Escape, when no editor inside it is open. The open lead SHALL be named in the page address, so that reloading the page or following the address reopens it. An address naming a lead that is not on the selected board, or that the member cannot reach, SHALL open no panel and show no error. On a narrow screen the panel SHALL cover the board until it is closed. Changing the selected board SHALL close the panel.

#### Scenario: Opening and switching
- **WHEN** a member clicks one lead's card and then another's
- **THEN** the panel shows the second lead and the board stays visible beside it

#### Scenario: Reloading with a lead open
- **WHEN** a member reloads the page while a lead's panel is open
- **THEN** the same lead's panel is open after the reload

#### Scenario: A lead from another board
- **WHEN** the address names a lead of a board other than the selected one
- **THEN** no panel opens and the board is shown as usual

### Requirement: The panel header names the lead and its stage

The panel header SHALL show the lead's letter avatar and name, the stage as a pill in its column's color, and a menu. A member who may update leads SHALL be able to rename the lead in place, and to pick another stage from every fixed stage and custom column of the board in board order. A new stage SHALL put the lead at the end of that column. A blank name SHALL be refused, and the previous name SHALL stay. A member who may delete leads SHALL find Удалить in the menu. Deleting SHALL ask for confirmation. A confirmed deletion SHALL close the panel and raise the alert Лид удалён.

#### Scenario: Changing the stage from the panel
- **WHEN** a member picks КП in the panel of a lead in Новый
- **THEN** the lead moves to the end of КП on the board and the pill turns green

#### Scenario: Deleting from the panel
- **WHEN** a member chooses Удалить and confirms
- **THEN** the panel closes, the card leaves the board and Лид удалён is shown

### Requirement: The panel offers its tabs

The panel SHALL offer the tabs Поля, Активность and Файлы. A lead that arrived through an integration SHALL also get Информация. Поля SHALL be shown first when a lead opens. Активность, Файлы and Информация SHALL keep the content and permissions they had in the lead card.

#### Scenario: A hand-made lead
- **WHEN** a member opens a lead a member created
- **THEN** the panel offers Поля, Активность and Файлы and no Информация

### Requirement: Fields are grouped

The Поля tab SHALL show labelled rows in collapsible groups, in this order:
- Сделка: Сумма сделки, Ответственный, Метки, Услуга, Источник. The stage is chosen in the header, not repeated here.
- Контакты:
  - Контакт, which picks a person of the board's client or creates one from a typed name;
  - the contact's Номер телефона, Telegram, Мессенджер and Email;
  - Организация, which picks or creates an organization the same way;
  - the organization's Сайт.

  Editing a contact or organization value SHALL change that record, and SHALL create it named after the lead when the lead has none. The contact and the organization SHALL each offer opening their own panel.
  Choosing to create a named contact or organization from these rows SHALL open the corresponding creation side panel. After creation, the new record SHALL be linked to the lead and the lead's panel SHALL return.
- Свои поля: the board's custom fields in board order. The group is omitted when the board has none.
- Описание: the lead's notes.
- Системные: Дата поступления and Откуда, which reads Вручную or Meta. Both are read-only.

An empty value SHALL show a quiet placeholder. The panel SHALL offer no campaign choice.

#### Scenario: The groups of a board with custom fields
- **WHEN** a member opens a lead on a board with the field Бюджет
- **THEN** the Поля tab shows Сделка, Контакты, Свои поля with Бюджет, Описание and Системные, in that order

#### Scenario: Picking an existing contact
- **WHEN** a member opens Контакт on a lead and picks Анна from the client's people
- **THEN** the lead points to Анна and the contact rows show Анна's phone and email

#### Scenario: Creating an organization from the panel
- **WHEN** a member types Лютик in Организация, which no organization of the client is named, and confirms
- **THEN** the organization Лютик is created for the client and linked to the lead

### Requirement: Each value is edited in place and saved on its own

A member who may update leads SHALL be able to activate any editable value to turn it into the editor for its type. The editors are the same as in the lead card: text, decimal, date, single and multiple choice, checkbox, address, member choice and tags. Saving SHALL work like this:
- Pressing Enter, or leaving the editor, SHALL store that value alone. In the description, Enter SHALL add a line, and leaving SHALL store it.
- Pressing Escape SHALL restore the stored value and store nothing.
- A checkbox, a choice and a date SHALL be stored as soon as they are picked.
- An invalid value SHALL keep the editor open with the reason beside it and store nothing.
- A save the API refuses SHALL restore the stored value and show the error.
- A stored value SHALL appear on the board card without a reload.

Members who may not update leads SHALL see every value and no editor. A phone SHALL be callable, an email writable, and a site or link openable in a new tab without giving the opened page access to the application.

#### Scenario: Editing the phone
- **WHEN** a member activates Номер телефона, types +375291112233 and presses Enter
- **THEN** only the phone is sent and stored, and the card shows the new phone

#### Scenario: Escaping an edit
- **WHEN** a member changes the company and presses Escape
- **THEN** the previous company is shown and nothing is sent

#### Scenario: An invalid amount
- **WHEN** a member types abc as Сумма сделки and leaves the field
- **THEN** the editor stays open with abc and the reason, and nothing is stored

#### Scenario: A guest
- **WHEN** a guest opens a lead
- **THEN** every value is shown, a site opens in a new tab, and no value can be edited
